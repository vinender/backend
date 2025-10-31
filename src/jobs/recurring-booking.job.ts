//@ts-nocheck
import cron from 'node-cron';
import prisma from '../config/database';
import { createNotification } from '../controllers/notification.controller';
import { subscriptionService } from '../services/subscription.service';
import { addDays, addMonths, format, isBefore, isAfter } from 'date-fns';

/**
 * Scheduled job to automatically create recurring bookings for the next billing cycle
 * Runs daily at 2 AM to check for subscriptions that need new bookings created
 */
export const initRecurringBookingJobs = () => {
  // Run daily at 2:00 AM to create upcoming recurring bookings
  cron.schedule('0 2 * * *', async () => {
    console.log('📅 Running recurring booking creation job...');

    try {
      const results = await createUpcomingRecurringBookings();

      console.log(`✅ Recurring booking job completed:`);
      console.log(`   - Created: ${results.created}`);
      console.log(`   - Skipped: ${results.skipped}`);
      console.log(`   - Failed: ${results.failed}`);
      console.log(`   - Cancelled: ${results.cancelled}`);
    } catch (error) {
      console.error('❌ Recurring booking job error:', error);

      // Notify admins of job failure
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' }
      });

      for (const admin of adminUsers) {
        await createNotification({
          userId: admin.id,
          type: 'RECURRING_JOB_ERROR',
          title: 'Recurring Booking Job Failed',
          message: `The automatic recurring booking job encountered an error: ${(error as any).message}`,
          data: {
            error: (error as any).message,
            timestamp: new Date()
          }
        });
      }
    }
  });

  console.log('✅ Recurring booking jobs initialized (runs daily at 2:00 AM)');
};

/**
 * Create upcoming recurring bookings for active subscriptions
 */
async function createUpcomingRecurringBookings() {
  const results = {
    created: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0
  };

  try {
    // Get system settings for max advance booking days
    const settings = await prisma.systemSettings.findFirst({
      select: { maxAdvanceBookingDays: true }
    });
    const maxAdvanceBookingDays = settings?.maxAdvanceBookingDays || 30;

    // Get all active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        cancelAtPeriodEnd: false
      },
      include: {
        field: {
          include: {
            owner: true
          }
        },
        user: true
      }
    });

    console.log(`📊 Found ${activeSubscriptions.length} active subscriptions`);

    for (const subscription of activeSubscriptions) {
      try {
        // Calculate next booking date
        let nextBookingDate = calculateNextBookingDate(subscription);

        // Check if we already have a booking for the next date
        const existingBooking = await prisma.booking.findFirst({
          where: {
            subscriptionId: subscription.id,
            date: nextBookingDate,
            status: {
              not: 'CANCELLED'
            }
          }
        });

        if (existingBooking) {
          console.log(`⏭️  Booking already exists for subscription ${subscription.id} on ${format(nextBookingDate, 'PPP')}`);
          results.skipped++;
          continue;
        }

        // Validate that next booking date is within advance booking days range
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxFutureDate = new Date(today);
        maxFutureDate.setDate(maxFutureDate.getDate() + maxAdvanceBookingDays);

        // Check if the last booking date has passed
        const lastBookingDate = subscription.lastBookingDate || new Date(subscription.createdAt);
        const lastBookingDateOnly = new Date(lastBookingDate);
        lastBookingDateOnly.setHours(0, 0, 0, 0);

        // Only create next booking if last booking date has passed
        if (isAfter(lastBookingDateOnly, today)) {
          console.log(`⏳ Last booking date (${format(lastBookingDate, 'PPP')}) has not passed yet for subscription ${subscription.id}`);
          results.skipped++;
          continue;
        }

        // Check if next booking date falls within advance booking range
        if (isAfter(nextBookingDate, maxFutureDate)) {
          console.log(`📆 Next booking date (${format(nextBookingDate, 'PPP')}) is beyond max advance booking days (${maxAdvanceBookingDays}) for subscription ${subscription.id}`);
          results.skipped++;
          continue;
        }

        // Check if next booking date is in the past
        if (isBefore(nextBookingDate, today)) {
          console.log(`⚠️  Next booking date (${format(nextBookingDate, 'PPP')}) is in the past for subscription ${subscription.id}`);

          // If the subscription is old and hasn't been used, cancel it
          const daysSinceLastBooking = Math.floor((today.getTime() - lastBookingDateOnly.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSinceLastBooking > 14) { // If no booking for 14+ days, consider cancelling
            console.log(`🚫 Cancelling inactive subscription ${subscription.id}`);

            // Cancel the subscription
            await subscriptionService.cancelSubscription(subscription.id, true);

            // Notify user
            await createNotification({
              userId: subscription.userId,
              type: 'subscription_auto_cancelled',
              title: 'Recurring Booking Cancelled',
              message: `Your ${subscription.interval} recurring booking for ${subscription.field.name} has been automatically cancelled due to inactivity.`,
              data: {
                subscriptionId: subscription.id,
                fieldId: subscription.fieldId,
                fieldName: subscription.field.name,
                reason: 'inactive'
              }
            });

            results.cancelled++;
            continue;
          }

          // Otherwise, calculate the next valid date
          nextBookingDate = calculateNextValidBookingDate(subscription, today);
        }

        // Check if field is still active and accepting bookings
        if (!subscription.field.isActive || !subscription.field.isApproved) {
          console.log(`⚠️  Field ${subscription.fieldId} is not active/approved for subscription ${subscription.id}`);
          results.skipped++;
          continue;
        }

        // Create the booking for the next billing cycle
        console.log(`✨ Creating booking for subscription ${subscription.id} on ${format(nextBookingDate, 'PPP')}`);

        const booking = await subscriptionService.createBookingFromSubscription(
          subscription.id,
          nextBookingDate
        );

        // Notify the user about the upcoming booking
        await createNotification({
          userId: subscription.userId,
          type: 'recurring_booking_created',
          title: 'Upcoming Booking Scheduled',
          message: `Your ${subscription.interval} booking at ${subscription.field.name} has been scheduled for ${format(nextBookingDate, 'PPP')} at ${subscription.timeSlot}`,
          data: {
            bookingId: booking.id,
            subscriptionId: subscription.id,
            fieldId: subscription.fieldId,
            fieldName: subscription.field.name,
            bookingDate: nextBookingDate.toISOString(),
            timeSlot: subscription.timeSlot
          }
        });

        // Send email to dog owner
        try {
          const { emailService } = await import('../services/email.service');
          await emailService.sendRecurringBookingEmailToDogOwner({
            email: subscription.user.email,
            userName: subscription.user.name || 'Valued Customer',
            fieldName: subscription.field.name,
            bookingDate: nextBookingDate,
            timeSlot: subscription.timeSlot,
            startTime: subscription.startTime,
            endTime: subscription.endTime,
            interval: subscription.interval,
            numberOfDogs: subscription.numberOfDogs,
            totalPrice: booking.totalPrice
          });
        } catch (emailError) {
          console.error('Failed to send recurring booking email to dog owner:', emailError);
        }

        // Notify the field owner
        if (subscription.field.ownerId && subscription.field.ownerId !== subscription.userId) {
          await createNotification({
            userId: subscription.field.ownerId,
            type: 'recurring_booking_scheduled',
            title: 'Recurring Booking Scheduled',
            message: `A ${subscription.interval} booking has been scheduled for ${subscription.field.name} on ${format(nextBookingDate, 'PPP')} at ${subscription.timeSlot}`,
            data: {
              bookingId: booking.id,
              subscriptionId: subscription.id,
              fieldId: subscription.fieldId,
              fieldName: subscription.field.name,
              bookingDate: nextBookingDate.toISOString(),
              timeSlot: subscription.timeSlot,
              dogOwnerName: subscription.user.name
            }
          });

          // Send email to field owner
          try {
            const { emailService } = await import('../services/email.service');
            await emailService.sendRecurringBookingEmailToFieldOwner({
              email: subscription.field.owner.email,
              ownerName: subscription.field.owner.name || 'Field Owner',
              fieldName: subscription.field.name,
              bookingDate: nextBookingDate,
              timeSlot: subscription.timeSlot,
              startTime: subscription.startTime,
              endTime: subscription.endTime,
              interval: subscription.interval,
              numberOfDogs: subscription.numberOfDogs,
              dogOwnerName: subscription.user.name || 'Dog Owner',
              totalPrice: booking.totalPrice,
              fieldOwnerAmount: booking.fieldOwnerAmount
            });
          } catch (emailError) {
            console.error('Failed to send recurring booking email to field owner:', emailError);
          }
        }

        results.created++;
        console.log(`✅ Created booking ${booking.id} for subscription ${subscription.id}`);

      } catch (error) {
        console.error(`❌ Failed to process subscription ${subscription.id}:`, error);
        results.failed++;

        // Notify user about the failure
        await createNotification({
          userId: subscription.userId,
          type: 'recurring_booking_failed',
          title: 'Booking Creation Failed',
          message: `We couldn't create your upcoming ${subscription.interval} booking. Please contact support.`,
          data: {
            subscriptionId: subscription.id,
            error: (error as any).message
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Error in createUpcomingRecurringBookings:', error);
    throw error;
  }

  return results;
}

/**
 * Calculate the next booking date based on subscription interval
 */
function calculateNextBookingDate(subscription: any): Date {
  const lastBookingDate = subscription.lastBookingDate || new Date(subscription.createdAt);

  if (subscription.interval === 'everyday') {
    // Add 1 day to last booking date
    return addDays(lastBookingDate, 1);
  } else if (subscription.interval === 'weekly') {
    // Add 7 days to last booking date
    return addDays(lastBookingDate, 7);
  } else if (subscription.interval === 'monthly') {
    // Add 1 month to last booking date
    return addMonths(lastBookingDate, 1);
  } else {
    throw new Error(`Unknown subscription interval: ${subscription.interval}`);
  }
}

/**
 * Calculate the next valid booking date starting from today
 */
function calculateNextValidBookingDate(subscription: any, today: Date): Date {
  let nextDate = new Date(today);

  if (subscription.interval === 'everyday') {
    // Next valid date is tomorrow
    return addDays(nextDate, 1);
  } else if (subscription.interval === 'weekly') {
    // Find next occurrence of the day of week
    const targetDayOfWeek = new Date(subscription.lastBookingDate || subscription.createdAt).getDay();
    const currentDayOfWeek = nextDate.getDay();

    let daysToAdd = targetDayOfWeek - currentDayOfWeek;
    if (daysToAdd <= 0) {
      daysToAdd += 7; // Move to next week
    }

    return addDays(nextDate, daysToAdd);
  } else if (subscription.interval === 'monthly') {
    // Use the day of month from original booking
    const targetDayOfMonth = subscription.dayOfMonth || new Date(subscription.lastBookingDate || subscription.createdAt).getDate();

    nextDate.setDate(1); // Start from first day of current month
    nextDate = addMonths(nextDate, 1); // Move to next month

    // Set to target day of month (handle cases where day doesn't exist in month)
    const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
    nextDate.setDate(Math.min(targetDayOfMonth, lastDayOfMonth));

    return nextDate;
  } else {
    throw new Error(`Unknown subscription interval: ${subscription.interval}`);
  }
}

/**
 * Manual trigger for testing or admin purposes
 */
export async function triggerRecurringBookingCreation() {
  console.log('🔧 Manually triggering recurring booking creation...');
  const results = await createUpcomingRecurringBookings();
  console.log('✅ Manual trigger completed:', results);
  return results;
}
