//@ts-nocheck
import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  getUnreadCount,
  deleteConversation
} from '../controllers/chat.controller';

const router = Router();

// All chat routes require authentication
router.use(protect);

// Conversation routes
router.post('/conversations', getOrCreateConversation);
router.get('/conversations', getConversations);
router.delete('/conversations/:conversationId', deleteConversation);

// Message routes
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/messages', sendMessage);

// Unread count
router.get('/unread-count', getUnreadCount);

export default router;
