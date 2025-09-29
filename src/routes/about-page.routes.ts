//@ts-nocheck
import { Router } from 'express'
import { getAboutPage, updateAboutPage, updateAboutSection } from '../controllers/about-page.controller'
import { authenticateAdmin } from '../middleware/admin.middleware'

const router = Router()

// Public route - anyone can view about page
router.get('/', getAboutPage)

// Admin only routes for updating
router.put('/', authenticateAdmin, updateAboutPage)
router.put('/section/:section', authenticateAdmin, updateAboutSection)

export default router
