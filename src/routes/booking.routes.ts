import { Router } from 'express';
import bookingController from '../controllers/booking.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

// Public routes to check availability
router.get('/availability', bookingController.checkAvailability);
router.get('/fields/:fieldId/slot-availability', bookingController.getSlotAvailability);

// All routes below require authentication
router.use(protect);

// Dog owner and field owner routes
router.get('/my-bookings', bookingController.getMyBookings);
router.get('/stats', bookingController.getBookingStats);
router.post('/', bookingController.createBooking);

// Admin routes
router.get('/', restrictTo('ADMIN'), bookingController.getAllBookings);
router.post('/mark-expired', restrictTo('ADMIN'), bookingController.markExpiredBookings);

// Booking specific routes
router
  .route('/:id')
  .get(bookingController.getBooking)
  .patch(bookingController.updateBooking)
  .delete(restrictTo('ADMIN'), bookingController.deleteBooking);

// Booking status management
router.patch('/:id/status', bookingController.updateBookingStatus);
router.get('/:id/refund-eligibility', bookingController.checkRefundEligibility);
router.patch('/:id/cancel', bookingController.cancelBooking);

export default router;