import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

const prisma = new PrismaClient();

// Flag to track if Kafka is available
let kafkaEnabled = false;
let producer: Producer | null = null;
let consumer: Consumer | null = null;

// Only initialize Kafka if explicitly enabled
if (process.env.ENABLE_KAFKA === 'true') {
  const kafka = new Kafka({
    clientId: 'fieldsy-chat',
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    retry: {
      initialRetryTime: 100,
      retries: 3, // Reduce retries to fail faster
    },
  });

  producer = kafka.producer();
  consumer = kafka.consumer({ groupId: 'chat-service-group' });
}

// Message types
export interface ChatMessage {
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
}

// Store Socket.io instance for direct message handling
let socketIO: SocketIOServer | null = null;

// Initialize Kafka producer and consumer (if enabled)
export const initializeKafka = async (io: SocketIOServer) => {
  socketIO = io; // Store the Socket.io instance
  
  if (!producer || !consumer) {
    console.log('Kafka is disabled. Messages will be handled directly.');
    kafkaEnabled = false;
    return;
  }

  try {
    // Connect producer
    await producer.connect();
    console.log('Kafka producer connected');

    // Connect consumer
    await consumer.connect();
    console.log('Kafka consumer connected');

    kafkaEnabled = true;

    // Subscribe to the chat topic
    await consumer.subscribe({ topic: 'chat-messages', fromBeginning: false });

    // Run the consumer
    await consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        try {
          if (!message.value) return;
          
          const chatMessage: ChatMessage = JSON.parse(message.value.toString());
          await processMessage(chatMessage, io);
        } catch (error) {
          console.error('Error processing Kafka message:', error);
        }
      },
    });
  } catch (error) {
    console.error('Kafka initialization failed, falling back to direct processing:', error);
    kafkaEnabled = false;
  }
};

// Process message (used by both Kafka and direct processing)
async function processMessage(chatMessage: ChatMessage, io: SocketIOServer) {
  try {
    // Save message to database
    const savedMessage = await prisma.message.create({
      data: {
        conversationId: chatMessage.conversationId,
        senderId: chatMessage.senderId,
        receiverId: chatMessage.receiverId,
        content: chatMessage.content,
        createdAt: chatMessage.timestamp,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Update conversation's last message
    await prisma.conversation.update({
      where: { id: chatMessage.conversationId },
      data: {
        lastMessage: chatMessage.content,
        lastMessageAt: chatMessage.timestamp,
      },
    });

    // Emit to Socket.io rooms
    io.to(`conversation:${chatMessage.conversationId}`).emit('new-message', savedMessage);
    
    // Notify receiver if not in conversation room
    io.to(`user:${chatMessage.receiverId}`).emit('new-message-notification', {
      conversationId: chatMessage.conversationId,
      message: savedMessage,
    });

    console.log(`Message processed: ${savedMessage.id}`);
    return savedMessage;
  } catch (error) {
    console.error('Error processing message:', error);
    throw error;
  }
}

// Send message to Kafka or process directly
export const sendMessageToKafka = async (message: ChatMessage) => {
  try {
    if (kafkaEnabled && producer) {
      // Send to Kafka if available
      await producer.send({
        topic: 'chat-messages',
        messages: [
          {
            key: message.conversationId,
            value: JSON.stringify(message),
          },
        ],
      });
      console.log('Message sent to Kafka');
    } else {
      // Process directly if Kafka is not available
      if (socketIO) {
        const savedMessage = await processMessage(message, socketIO);
        console.log('Message processed directly (Kafka disabled)');
        return savedMessage;
      } else {
        throw new Error('Socket.io not initialized');
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    // If Kafka fails, try direct processing as fallback
    if (socketIO && !error.message.includes('Socket.io')) {
      console.log('Kafka failed, processing message directly');
      return await processMessage(message, socketIO);
    }
    throw error;
  }
};

// Graceful shutdown
export const shutdownKafka = async () => {
  if (producer) {
    await producer.disconnect();
  }
  if (consumer) {
    await consumer.disconnect();
  }
  if (kafkaEnabled) {
    console.log('Kafka connections closed');
  }
};