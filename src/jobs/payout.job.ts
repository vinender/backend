//@ts-nocheck
import cron from 'node-cron';
import refundService from '../services/refund.service';
import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import { automaticPayoutService } from '../services/auto-payout.service';

/**
 * Scheduled job to process payouts for completed bookings
 * Runs every hour to check for bookings that have passed their cancellation period
 */
export const initPayoutJobs = () => {
  // Run every 30 minutes to mark past bookings as completed
  cron.schedule('*/30 * * * *', async () => {
    console.log('📋 Marking past bookings as completed...');
    
    try {
      const now = new Date();
      
      // Find all bookings that are past their date/time and not already completed or cancelled
      const completedBookings = await prisma.booking.updateMany({
        where: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          date: {
            lt: now,
          },
        },
        data: {
          status: 'COMPLETED',
        },
      });
      
      console.log(`✅ Marked ${completedBookings.count} bookings as completed`);
      
      // Now trigger payouts for newly completed bookings
      if (completedBookings.count > 0) {
        // Get the bookings that were just marked as completed
        const newlyCompletedBookings = await prisma.booking.findMany({
          where: {
            status: 'COMPLETED',
            payoutStatus: null,
            paymentStatus: 'PAID',
            updatedAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000) // Updated in last 5 minutes
            }
          }
        });
        
        // Import payout service
        const { payoutService } = await import('../services/payout.service');
        
        // Process payouts for each booking
        for (const booking of newlyCompletedBookings) {
          try {
            await payoutService.processBookingPayout(booking.id);
            console.log(`💰 Payout processed for booking ${booking.id}`);
          } catch (error) {
            console.error(`Failed to process payout for booking ${booking.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error marking bookings as completed:', error);
    }
  });
  
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('🏦 Running scheduled automatic payout job...');
    
    try {
      // Process automatic payouts for bookings past cancellation window
      const results = await automaticPayoutService.processEligiblePayouts();
      
      console.log(`✅ Automatic payouts processed:`);
      console.log(`   - Processed: ${results.processed}`);
      console.log(`   - Skipped: ${results.skipped}`);
      console.log(`   - Failed: ${results.failed}`);
      
      // Process payouts for completed bookings past cancellation period (legacy)
      await refundService.processCompletedBookingPayouts();
      
      // Also check for any failed payouts to retry
      await retryFailedPayouts();
      
      console.log('✅ Payout job completed successfully');
    } catch (error) {
      console.error('❌ Payout job error:', error);
      
      // Notify admins of job failure
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' }
      });
      
      for (const admin of adminUsers) {
        await createNotification({
          userId: admin.id,
          type: 'PAYOUT_JOB_ERROR',
          title: 'Scheduled Payout Job Failed',
          message: `The automatic payout job encountered an error: ${(error as any).message}`,
          data: {
            error: (error as any).message,
            timestamp: new Date()
          }
        });
      }
    }
  });

  // Run daily at midnight to calculate and update field owner earnings
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily earnings calculation...');
    
    try {
      await calculateFieldOwnerEarnings();
      console.log('Earnings calculation completed');
    } catch (error) {
      console.error('Earnings calculation error:', error);
    }
  });
};

/**
 * Retry failed payouts
 */
async function retryFailedPayouts() {
  try {
    const failedPayouts = await prisma.payout.findMany({
      where: {
        status: 'failed',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Only retry payouts from last 24 hours
        }
      },
      include: {
        stripeAccount: {
          include: {
            user: true
          }
        }
      }
    });

    for (const payout of failedPayouts) {
      // Check if Stripe account is now ready
      if (!payout.stripeAccount.payoutsEnabled) {
        continue; // Skip if account still not ready
      }

      try {
        // Attempt to retry the payout
        const { stripe } = require('../config/stripe.config');
        
        const transfer = await stripe.transfers.create({
          amount: Math.round(payout.amount * 100),
          currency: payout.currency,
          destination: payout.stripeAccount.stripeAccountId,
          description: payout.description || `Retry payout ${payout.id}`,
          metadata: {
            payoutId: payout.id,
            retryAttempt: 'true'
          }
        });

        // Update payout status
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'paid',
            stripePayoutId: transfer.id,
            arrivalDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
          }
        });

        // Send success notification
        await createNotification({
          userId: payout.stripeAccount.userId,
          type: 'payout_retry_success',
          title: 'Payout Processed',
          message: `Your previously failed payout of £${payout.amount.toFixed(2)} has been successfully processed.`,
          data: {
            payoutId: payout.id,
            amount: payout.amount
          }
        });

        console.log(`Successfully retried payout ${payout.id}`);
      } catch (retryError: any) {
        console.error(`Failed to retry payout ${payout.id}:`, retryError);
        
        // Update failure reason
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            failureMessage: retryError.message,
            failureCode: retryError.code
          }
        });
      }
    }
  } catch (error) {
    console.error('Retry failed payouts error:', error);
  }
}

/**
 * Calculate and update field owner earnings
 */
async function calculateFieldOwnerEarnings() {
  try {
    // Get all field owners
    const fieldOwners = await prisma.user.findMany({
      where: {
        role: 'FIELD_OWNER',
        stripeAccount: {
          isNot: null
        }
      },
      include: {
        stripeAccount: true,
        ownedFields: {
          include: {
            bookings: {
              where: {
                OR: [
                  { status: 'COMPLETED' },
                  { 
                    status: 'CANCELLED',
                    cancelledAt: {
                      not: null
                    }
                  }
                ]
              },
              include: {
                payment: true
              }
            }
          }
        }
      }
    });

    for (const owner of fieldOwners) {
      let totalEarnings = 0;
      let pendingEarnings = 0;
      let availableEarnings = 0;
      
      for (const field of owner.ownedFields) {
        for (const booking of field.bookings) {
          if (!booking.payment) continue;

          // Get field owner amount - use stored or calculate dynamically
          let bookingAmount = booking.fieldOwnerAmount;
          if (!bookingAmount) {
            const { calculatePayoutAmounts } = require('../utils/commission.utils');
            const calculated = await calculatePayoutAmounts(booking.totalPrice, owner.id);
            bookingAmount = calculated.fieldOwnerAmount;
          }
          
          if (booking.payoutStatus === 'COMPLETED') {
            totalEarnings += bookingAmount;
            availableEarnings += bookingAmount;
          } else if (booking.payoutStatus === 'PROCESSING' || booking.payoutStatus === 'PENDING') {
            pendingEarnings += bookingAmount;
          }
        }
      }

      // Get all successful payouts
      const payouts = await prisma.payout.findMany({
        where: {
          stripeAccountId: owner.stripeAccount!.id,
          status: 'paid'
        }
      });

      const totalPayouts = payouts.reduce((sum, payout) => sum + payout.amount, 0);
      
      // Update user's earning statistics (you may need to add these fields to User model)
      // For now, we'll store this in a notification
      await createNotification({
        userId: owner.id,
        type: 'earnings_update',
        title: 'Earnings Update',
        message: `Your current earnings: Total: $${totalEarnings.toFixed(2)}, Available: $${availableEarnings.toFixed(2)}, Pending: $${pendingEarnings.toFixed(2)}`,
        data: {
          totalEarnings,
          availableEarnings,
          pendingEarnings,
          totalPayouts
        }
      });
    }
  } catch (error) {
    console.error('Calculate earnings error:', error);
  }
}

/**
 * Process automatic transfers for bookings past cancellation period
 * This ensures field owners receive their share after 24 hours even if no cancellation occurred
 */
export async function processAutomaticTransfers() {
  try {
    const eligibleBookings = await prisma.booking.findMany({
      where: {
        status: 'COMPLETED',
        payoutStatus: null,
        date: {
          lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours after booking date
        }
      },
      include: {
        payment: true,
        field: {
          include: {
            owner: {
              include: {
                stripeAccount: true
              }
            }
          }
        }
      }
    });

    for (const booking of eligibleBookings) {
      if (!booking.payment || booking.payment.status !== 'completed') {
        continue;
      }

      try {
        // Mark as processing to avoid duplicate processing
        await prisma.booking.update({
          where: { id: booking.id },
          data: { payoutStatus: 'PROCESSING' }
        });

        // Process the payout
        await refundService.processFieldOwnerPayout(booking, 0);
        
        console.log(`Processed automatic transfer for booking ${booking.id}`);
      } catch (error) {
        console.error(`Failed to process transfer for booking ${booking.id}:`, error);
        
        // Revert status on error
        await prisma.booking.update({
          where: { id: booking.id },
          data: { payoutStatus: null }
        });
      }
    }
  } catch (error) {
    console.error('Process automatic transfers error:', error);
  }
}
