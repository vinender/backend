//@ts-nocheck
import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import refundService from '../services/refund.service';
import { processAutomaticTransfers } from '../jobs/payout.job';

const router = Router();

// Require admin role for all routes
router.use(protect);
router.use(requireRole('ADMIN'));

// Manually trigger payout processing for testing
router.post('/process-payouts', async (req, res) => {
  try {
    console.log('Manually triggering payout processing...');
    
    // Process completed bookings past cancellation period
    await refundService.processCompletedBookingPayouts();
    
    // Process automatic transfers
    await processAutomaticTransfers();
    
    res.json({
      success: true,
      message: 'Payout processing triggered successfully'
    });
  } catch (error: any) {
    console.error('Manual payout trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process payouts'
    });
  }
});

// Get payout statistics
router.get('/payout-stats', async (req, res) => {
  try {
    const prisma = (await import('../config/database')).default;
    
    // Get overall statistics
    const [totalPayouts, pendingPayouts, completedPayouts, failedPayouts] = await Promise.all([
      prisma.payout.count(),
      prisma.payout.count({ where: { status: 'pending' } }),
      prisma.payout.count({ where: { status: 'paid' } }),
      prisma.payout.count({ where: { status: 'failed' } })
    ]);

    // Get total amounts
    const [totalAmount, pendingAmount, paidAmount] = await Promise.all([
      prisma.payout.aggregate({
        _sum: { amount: true }
      }),
      prisma.payout.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true }
      }),
      prisma.payout.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true }
      })
    ]);

    // Get bookings awaiting payout
    const bookingsAwaitingPayout = await prisma.booking.count({
      where: {
        status: 'COMPLETED',
        payoutStatus: null,
        date: {
          lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours old
        }
      }
    });

    res.json({
      success: true,
      stats: {
        payouts: {
          total: totalPayouts,
          pending: pendingPayouts,
          completed: completedPayouts,
          failed: failedPayouts
        },
        amounts: {
          total: totalAmount._sum.amount || 0,
          pending: pendingAmount._sum.amount || 0,
          paid: paidAmount._sum.amount || 0
        },
        bookingsAwaitingPayout
      }
    });
  } catch (error: any) {
    console.error('Payout stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payout statistics'
    });
  }
});

export default router;
