"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteConversation = exports.getUnreadCount = exports.sendMessage = exports.getMessages = exports.getConversations = exports.getOrCreateConversation = void 0;
const client_1 = require("@prisma/client");
const kafka_1 = require("../config/kafka");
const prisma = new client_1.PrismaClient();
// Get or create conversation
const getOrCreateConversation = async (req, res) => {
    try {
        const { receiverId, fieldId } = req.body;
        const senderId = req.user.id;
        if (!receiverId) {
            return res.status(400).json({ error: 'Receiver ID is required' });
        }
        // Check if conversation already exists
        let conversation = await prisma.conversation.findFirst({
            where: {
                participants: {
                    hasEvery: [senderId, receiverId]
                },
                fieldId: fieldId || undefined
            },
            include: {
                field: {
                    select: {
                        id: true,
                        name: true,
                        images: true
                    }
                }
            }
        });
        if (!conversation) {
            // Create new conversation
            conversation = await prisma.conversation.create({
                data: {
                    participants: [senderId, receiverId],
                    fieldId: fieldId || undefined
                },
                include: {
                    field: {
                        select: {
                            id: true,
                            name: true,
                            images: true
                        }
                    }
                }
            });
        }
        // Get participants info
        const participants = await prisma.user.findMany({
            where: {
                id: {
                    in: [senderId, receiverId]
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true
            }
        });
        res.json({
            ...conversation,
            participants: participants
        });
    }
    catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
};
exports.getOrCreateConversation = getOrCreateConversation;
// Get user's conversations
const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const conversations = await prisma.conversation.findMany({
            where: {
                participants: {
                    has: userId
                }
            },
            include: {
                field: {
                    select: {
                        id: true,
                        name: true,
                        images: true
                    }
                },
                messages: {
                    take: 1,
                    orderBy: {
                        createdAt: 'desc'
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
                }
            },
            orderBy: {
                lastMessageAt: 'desc'
            },
            skip,
            take: Number(limit)
        });
        // Get participants info for each conversation
        const conversationsWithParticipants = await Promise.all(conversations.map(async (conv) => {
            const participants = await prisma.user.findMany({
                where: {
                    id: {
                        in: conv.participants
                    }
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    role: true
                }
            });
            // Get unread count
            const unreadCount = await prisma.message.count({
                where: {
                    conversationId: conv.id,
                    receiverId: userId,
                    isRead: false
                }
            });
            return {
                ...conv,
                participants,
                unreadCount
            };
        }));
        // Get total count
        const total = await prisma.conversation.count({
            where: {
                participants: {
                    has: userId
                }
            }
        });
        res.json({
            conversations: conversationsWithParticipants,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};
exports.getConversations = getConversations;
// Get messages for a conversation
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        // Verify user is part of the conversation
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    has: userId
                }
            }
        });
        if (!conversation) {
            return res.status(403).json({ error: 'Access denied' });
        }
        // Get messages
        const messages = await prisma.message.findMany({
            where: {
                conversationId
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        role: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        role: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: Number(limit)
        });
        // Mark messages as read
        await prisma.message.updateMany({
            where: {
                conversationId,
                receiverId: userId,
                isRead: false
            },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });
        // Get total count
        const total = await prisma.message.count({
            where: {
                conversationId
            }
        });
        res.json({
            messages: messages.reverse(), // Reverse to get chronological order
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};
exports.getMessages = getMessages;
// Send a message
const sendMessage = async (req, res) => {
    try {
        const { conversationId, content, receiverId } = req.body;
        const senderId = req.user.id;
        if (!conversationId || !content || !receiverId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Verify user is part of the conversation
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    has: senderId
                }
            }
        });
        if (!conversation) {
            return res.status(403).json({ error: 'Access denied' });
        }
        // Check if users have blocked each other
        const [senderBlockedReceiver, receiverBlockedSender] = await Promise.all([
            prisma.userBlock.findUnique({
                where: {
                    blockerId_blockedUserId: {
                        blockerId: senderId,
                        blockedUserId: receiverId
                    }
                }
            }),
            prisma.userBlock.findUnique({
                where: {
                    blockerId_blockedUserId: {
                        blockerId: receiverId,
                        blockedUserId: senderId
                    }
                }
            })
        ]);
        if (senderBlockedReceiver || receiverBlockedSender) {
            return res.status(403).json({
                error: 'Cannot send messages. One or both users have blocked each other.',
                blocked: true
            });
        }
        // Send message to Kafka for processing
        const savedMessage = await (0, kafka_1.sendMessageToKafka)({
            conversationId,
            senderId,
            receiverId,
            content,
            timestamp: new Date()
        });
        // Return the saved message
        res.json(savedMessage || { success: true, message: 'Message queued for delivery' });
    }
    catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};
exports.sendMessage = sendMessage;
// Get unread message count
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const unreadCount = await prisma.message.count({
            where: {
                receiverId: userId,
                isRead: false
            }
        });
        res.json({ unreadCount });
    }
    catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
};
exports.getUnreadCount = getUnreadCount;
// Delete conversation
const deleteConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        if (!conversationId) {
            return res.status(400).json({ error: 'Conversation ID is required' });
        }
        // Verify user is part of the conversation
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    has: userId
                }
            }
        });
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        // Delete all messages in the conversation
        await prisma.message.deleteMany({
            where: {
                conversationId
            }
        });
        // Delete the conversation
        await prisma.conversation.delete({
            where: {
                id: conversationId
            }
        });
        res.json({ success: true, message: 'Conversation deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
};
exports.deleteConversation = deleteConversation;
