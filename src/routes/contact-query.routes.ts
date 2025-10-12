//@ts-nocheck
import { Router } from 'express'
import {
  createContactQuery,
  getAllContactQueries,
  getContactQueryById,
  updateContactQuery,
  deleteContactQuery,
} from '../controllers/contact-query.controller'
import { authenticateAdmin } from '../middleware/admin.middleware'

const router = Router()

// Public route - anyone can submit a contact query
router.post('/', createContactQuery)

// Admin only routes
router.get('/', authenticateAdmin, getAllContactQueries)
router.get('/:id', authenticateAdmin, getContactQueryById)
router.put('/:id', authenticateAdmin, updateContactQuery)
router.delete('/:id', authenticateAdmin, deleteContactQuery)

export default router
