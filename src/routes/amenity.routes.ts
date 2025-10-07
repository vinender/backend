import { Router } from 'express';
import {
  getAmenities,
  getAmenityById,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  reorderAmenities
} from '../controllers/amenity.controller';
import { authenticateAdmin } from '../middleware/admin.middleware';

console.log('🔍 Amenity routes file loaded');

const router = Router();
console.log('🔍 Amenity router created');

// Public routes
router.get('/', getAmenities); // Get all amenities (with optional activeOnly filter)
router.get('/:id', getAmenityById); // Get single amenity

// Admin routes
router.post('/', authenticateAdmin, createAmenity); // Create amenity
router.put('/:id', authenticateAdmin, updateAmenity); // Update amenity
router.delete('/:id', authenticateAdmin, deleteAmenity); // Delete amenity
router.post('/reorder', authenticateAdmin, reorderAmenities); // Reorder amenities

export default router;
