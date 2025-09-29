"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get initializeKafka () {
        return initializeKafka;
    },
    get sendMessageToKafka () {
        return sendMessageToKafka;
    },
    get shutdownKafka () {
        return shutdownKafka;
    }
});
const _kafkajs = require("kafkajs");
const _client = require("@prisma/client");
const prisma = new _client.PrismaClient();
// Flag to track if Kafka is available
let kafkaEnabled = false;
let producer = null;
let consumer = null;
// Only initialize Kafka if explicitly enabled
if (process.env.ENABLE_KAFKA === 'true') {
    const kafka = new _kafkajs.Kafka({
        clientId: 'fieldsy-chat',
        brokers: [
            process.env.KAFKA_BROKER || 'localhost:9092'
        ],
        retry: {
            initialRetryTime: 100,
            retries: 3
        }
    });
    producer = kafka.producer();
    consumer = kafka.consumer({
        groupId: 'chat-service-group'
    });
}
// Store Socket.io instance for direct message handling
let socketIO = null;
const initializeKafka = async (io)=>{
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
        await consumer.subscribe({
            topic: 'chat-messages',
            fromBeginning: false
        });
        // Run the consumer
        await consumer.run({
            eachMessage: async ({ topic, partition, message })=>{
                try {
                    if (!message.value) return;
                    const chatMessage = JSON.parse(message.value.toString());
                    await processMessage(chatMessage, io);
                } catch (error) {
                    console.error('Error processing Kafka message:', error);
                }
            }
        });
    } catch (error) {
        console.error('Kafka initialization failed, falling back to direct processing:', error);
        kafkaEnabled = false;
    }
};
// Process message (used by both Kafka and direct processing)
async function processMessage(chatMessage, io) {
    try {
        console.log('[ProcessMessage] Processing message:', {
            conversationId: chatMessage.conversationId,
            senderId: chatMessage.senderId,
            receiverId: chatMessage.receiverId
        });
        // Save message to database
        const savedMessage = await prisma.message.create({
            data: {
                conversationId: chatMessage.conversationId,
                senderId: chatMessage.senderId,
                receiverId: chatMessage.receiverId,
                content: chatMessage.content,
                createdAt: chatMessage.timestamp
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        image: true
                    }
                }
            }
        });
        // Update conversation's last message
        await prisma.conversation.update({
            where: {
                id: chatMessage.conversationId
            },
            data: {
                lastMessage: chatMessage.content,
                lastMessageAt: chatMessage.timestamp
            }
        });
        // Emit to Socket.io rooms
        const conversationRoom = `conversation:${chatMessage.conversationId}`;
        const receiverRoom = `user-${chatMessage.receiverId}`;
        console.log('[ProcessMessage] Emitting to rooms:', {
            conversationRoom,
            receiverRoom
        });
        // Check if anyone is in these rooms
        const conversationSockets = await io.in(conversationRoom).fetchSockets();
        const receiverSockets = await io.in(receiverRoom).fetchSockets();
        console.log('[ProcessMessage] Room status:', {
            conversationRoom: `${conversationSockets.length} sockets`,
            receiverRoom: `${receiverSockets.length} sockets`
        });
        // Emit to conversation room
        io.to(conversationRoom).emit('new-message', savedMessage);
        // Notify receiver if not in conversation room - use hyphen for consistency
        io.to(receiverRoom).emit('new-message-notification', {
            conversationId: chatMessage.conversationId,
            message: savedMessage
        });
        // Also emit to the receiver's room with the standard 'new-message' event
        io.to(receiverRoom).emit('new-message', savedMessage);
        console.log(`[ProcessMessage] Message processed and emitted: ${savedMessage.id}`);
        return savedMessage;
    } catch (error) {
        console.error('Error processing message:', error);
        throw error;
    }
}
const sendMessageToKafka = async (message)=>{
    try {
        if (kafkaEnabled && producer) {
            // Send to Kafka if available
            await producer.send({
                topic: 'chat-messages',
                messages: [
                    {
                        key: message.conversationId,
                        value: JSON.stringify(message)
                    }
                ]
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
        if (socketIO && error instanceof Error && !error.message.includes('Socket.io')) {
            console.log('Kafka failed, processing message directly');
            return await processMessage(message, socketIO);
        }
        throw error;
    }
};
const shutdownKafka = async ()=>{
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

//# sourceMappingURL=kafka.js.map