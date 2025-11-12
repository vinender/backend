//@ts-nocheck
import { Request, Response } from 'express';
import { stripe } from '../config/stripe.config';
import prisma from '../config/database';
import Stripe from 'stripe';
import { createNotification } from './notification.controller';
import { NotificationService } from '../services/notification.service';
import { calculatePayoutAmounts } from '../utils/commission.utils';
import { subscriptionService } from '../services/subscription.service';
import { emailService } from '../services/email.service';

export class PaymentController {
  // Create a payment intent for booking a field
  async createPaymentIntent(req: Request, res: Response) {
    try {
      const {
        fieldId,
        numberOfDogs,
        date,
        timeSlot,
        repeatBooking,
        amount,
        paymentMethodId // Optional: use saved payment method
      } = req.body;

      // Validate user
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get user for Stripe customer
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          stripeCustomerId: true
        }
      });

      // Check if user is blocked (field might not exist in production yet)
      try {
        const userBlockStatus = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            isBlocked: true,
            blockReason: true
          }
        });

        if (userBlockStatus?.isBlocked) {
          return res.status(403).json({
            error: 'Your account has been blocked',
            reason: userBlockStatus.blockReason || 'Please contact support for more information'
          });
        }
      } catch (error) {
        // isBlocked field doesn't exist in production yet, skip check
        console.warn('Warning: isBlocked field not found in User model.');
      }

      // Create idempotency key to prevent duplicate bookings
      // Use a unique key for each payment intent attempt
      const crypto = require('crypto');
      const requestId = crypto.randomBytes(16).toString('hex');
      const idempotencyKey = `booking_${userId}_${fieldId}_${date}_${timeSlot}_${requestId}`.replace(/[\s:]/g, '_');

      // Check if a booking already exists for this exact combination
      const existingBooking = await prisma.booking.findFirst({
        where: {
          userId,
          fieldId,
          date: new Date(date),
          timeSlot,
          status: {
            notIn: ['CANCELLED']
          }
        }
      });

      if (existingBooking) {
        console.log('Duplicate booking attempt detected:', {
          userId,
          fieldId,
          date,
          timeSlot,
          existingBookingId: existingBooking.id
        });

        // Check if the existing booking is already paid
        if (existingBooking.paymentStatus === 'PAID' && existingBooking.status === 'CONFIRMED') {
          // Return existing booking info instead of creating duplicate
          return res.status(200).json({
            paymentSucceeded: true,
            bookingId: existingBooking.id,
            message: 'Booking already exists and is confirmed',
            isDuplicate: true
          });
        } else if (existingBooking.paymentStatus === 'PENDING') {
          // If there's a pending booking, we can try to complete it
          // but for safety, we'll still prevent duplicate creation
          return res.status(200).json({
            paymentSucceeded: false,
            bookingId: existingBooking.id,
            message: 'A booking for this slot is already being processed',
            isDuplicate: true,
            isPending: true
          });
        }
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Validate field exists
      const field = await prisma.field.findUnique({
        where: { id: fieldId }
      });

      if (!field) {
        return res.status(404).json({ error: 'Field not found' });
      }

      // Calculate amount in cents (Stripe uses smallest currency unit)
      const amountInCents = Math.round(amount * 100);

      // Calculate platform commission dynamically using commission utils
      const { fieldOwnerAmount, platformCommission, commissionRate } =
        await calculatePayoutAmounts(amount, field.ownerId || '');

      // Prepare payment intent parameters
      // Payment goes to platform account (admin) first
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: 'eur',
        metadata: {
          userId,
          fieldId,
          fieldOwnerId: field.ownerId || '',
          numberOfDogs: numberOfDogs.toString(),
          date,
          timeSlot,
          repeatBooking: repeatBooking || 'none',
          type: 'field_booking',
          platformCommission: platformCommission.toString(),
          fieldOwnerAmount: fieldOwnerAmount.toString(),
          commissionRate: commissionRate.toString()
        },
        description: `Booking for ${field.name} on ${date} at ${timeSlot}`,
        receipt_email: (req as any).user?.email,
      };

      // If a payment method is provided, use it
      if (paymentMethodId) {
        // Verify the payment method belongs to this user
        const paymentMethod = await prisma.paymentMethod.findFirst({
          where: {
            id: paymentMethodId,
            userId: userId
          }
        });

        if (!paymentMethod) {
          return res.status(400).json({ error: 'Invalid payment method' });
        }

        // Ensure user has a valid Stripe customer ID
        let customerId = user.stripeCustomerId;
        
        // Verify customer exists in Stripe
        if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if ((customer as any).deleted) {
              console.log(`Stripe customer ${customerId} was deleted, creating new one`);
              customerId = null; // Force recreation
            }
          } catch (error: any) {
            if (error.statusCode === 404 || error.code === 'resource_missing') {
              console.log(`Stripe customer ${customerId} not found, creating new one`);
              customerId = null; // Force recreation
            } else {
              throw error; // Re-throw other errors
            }
          }
        }
        
        // Create customer if doesn't exist or was invalid
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: user.name || undefined,
            metadata: {
              userId: user.id
            }
          });
          customerId = customer.id;
          
          // Save customer ID
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: customerId }
          });
        }

        try {
          // Verify the payment method still exists in Stripe
          const stripePaymentMethod = await stripe.paymentMethods.retrieve(
            paymentMethod.stripePaymentMethodId
          );

          // Check if payment method is attached to the customer
          if (stripePaymentMethod.customer !== customerId) {
            // Attach payment method to customer if not already attached
            await stripe.paymentMethods.attach(
              paymentMethod.stripePaymentMethodId,
              { customer: customerId }
            );
          }
        } catch (stripeError: any) {
          console.error('Stripe payment method error:', stripeError);
          
          // Payment method doesn't exist or is invalid
          if (stripeError.code === 'resource_missing' || stripeError.statusCode === 404) {
            // Remove invalid payment method from database
            await prisma.paymentMethod.delete({
              where: { id: paymentMethodId }
            });
            
            return res.status(400).json({ 
              error: 'Payment method no longer valid. Please add a new payment method.',
              code: 'PAYMENT_METHOD_EXPIRED'
            });
          }
          
          // Other Stripe errors
          return res.status(400).json({ 
            error: 'Unable to process payment method. Please try again or use a different payment method.',
            code: 'PAYMENT_METHOD_ERROR'
          });
        }

        paymentIntentParams.customer = customerId;
        paymentIntentParams.payment_method = paymentMethod.stripePaymentMethodId;
        paymentIntentParams.confirm = true; // Auto-confirm the payment
        paymentIntentParams.return_url = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/user/my-bookings`; // Add return URL for 3D Secure
        // Use specific payment method configuration
        paymentIntentParams.automatic_payment_methods = {
          enabled: true,
          allow_redirects: 'never' // Never allow redirect-based payment methods
        };
      } else {
        // Use automatic payment methods for new card entry
        paymentIntentParams.automatic_payment_methods = {
          enabled: true,
        };
      }

      // Create payment intent with error handling and idempotency
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
          idempotencyKey: idempotencyKey
        });
      } catch (stripeError: any) {
        console.error('Error creating payment intent:', stripeError);
        
        // Handle specific Stripe errors
        if (stripeError.type === 'StripeInvalidRequestError') {
          if (stripeError.message.includes('No such PaymentMethod')) {
            return res.status(400).json({ 
              error: 'Payment method not found. Please select a different payment method.',
              code: 'PAYMENT_METHOD_NOT_FOUND'
            });
          }
          if (stripeError.message.includes('Payment method not available')) {
            return res.status(400).json({ 
              error: 'This payment method is not available. Please try a different payment method.',
              code: 'PAYMENT_METHOD_UNAVAILABLE'
            });
          }
        }
        
        // Generic payment error
        return res.status(500).json({ 
          error: 'Unable to process payment. Please try again.',
          code: 'PAYMENT_PROCESSING_ERROR',
          details: process.env.NODE_ENV === 'development' ? stripeError.message : undefined
        });
      }

      // Parse the time slot to extract start and end times
      // Expected format: "4:00PM - 5:00PM"
      const [startTimeStr, endTimeStr] = timeSlot.split(' - ').map(t => t.trim());
      
      // Create a booking record with appropriate status
      const bookingStatus = paymentIntent.status === 'succeeded' ? 'CONFIRMED' : 'PENDING';
      const paymentStatus = paymentIntent.status === 'succeeded' ? 'PAID' : 'PENDING';
      
      // Check if field owner has a connected Stripe account
      const fieldOwnerStripeAccount = await prisma.stripeAccount.findUnique({
        where: { userId: field.ownerId }
      });
      
      // Get system settings for payout release schedule
      const systemSettings = await prisma.systemSettings.findFirst();
      const payoutReleaseSchedule = systemSettings?.payoutReleaseSchedule || 'after_cancellation_window';
      
      // Determine payout status based on Stripe account connection and release schedule
      let payoutStatus = 'PENDING';
      let payoutHeldReason = undefined;
      
      if (paymentIntent.status === 'succeeded') {
        if (!fieldOwnerStripeAccount || !fieldOwnerStripeAccount.chargesEnabled || !fieldOwnerStripeAccount.payoutsEnabled) {
          // Hold the payout if field owner doesn't have a connected Stripe account
          payoutStatus = 'HELD';
          payoutHeldReason = 'NO_STRIPE_ACCOUNT';
        } else if (payoutReleaseSchedule === 'on_weekend') {
          // Check if today is weekend
          const today = new Date().getDay();
          if (today === 5 || today === 6 || today === 0) { // Friday, Saturday, Sunday
            payoutStatus = 'PENDING';
          } else {
            payoutStatus = 'HELD';
            payoutHeldReason = 'WAITING_FOR_WEEKEND';
          }
        } else { // after_cancellation_window
          payoutStatus = 'HELD';
          payoutHeldReason = 'WITHIN_CANCELLATION_WINDOW';
        }
      }
      
      // Get field owner details for snapshot
      const fieldOwner = await prisma.user.findUnique({
        where: { id: field.ownerId },
        select: { name: true, email: true }
      });

      // If this is a recurring booking, create subscription first
      let subscriptionId = undefined;
      const recurringOptions = ['everyday', 'weekly', 'monthly'];
      const normalizedRepeatBooking = repeatBooking?.toLowerCase();

      console.log('🔍 REPEAT BOOKING CHECK:', {
        repeatBooking,
        normalizedRepeatBooking,
        isIncluded: recurringOptions.includes(normalizedRepeatBooking),
        recurringOptions
      });

      if (repeatBooking && recurringOptions.includes(normalizedRepeatBooking)) {
        console.log('✅ Creating subscription for recurring booking...');
        try {
          // Create subscription record in database
          const bookingDate = new Date(date);
          const dayOfWeek = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
          const dayOfMonth = bookingDate.getDate();

          // Calculate next billing date
          let nextBillingDate: Date;
          let currentPeriodEnd: Date;

          if (normalizedRepeatBooking === 'everyday') {
            // Next billing is 1 day after the booking date
            nextBillingDate = new Date(bookingDate);
            nextBillingDate.setDate(bookingDate.getDate() + 1);

            currentPeriodEnd = new Date(bookingDate);
            currentPeriodEnd.setDate(bookingDate.getDate() + 1);
          } else if (normalizedRepeatBooking === 'weekly') {
            // Next billing is 7 days after the booking date
            nextBillingDate = new Date(bookingDate);
            nextBillingDate.setDate(bookingDate.getDate() + 7);

            currentPeriodEnd = new Date(bookingDate);
            currentPeriodEnd.setDate(bookingDate.getDate() + 7);
          } else {
            // Monthly - next billing is same date next month
            nextBillingDate = new Date(bookingDate);
            nextBillingDate.setMonth(bookingDate.getMonth() + 1);

            // Handle edge case: if current day is 31 and next month has fewer days
            // JavaScript automatically adjusts (e.g., Jan 31 + 1 month = Mar 3 if Feb has 28 days)
            // To fix this, we ensure it stays on the last day of the month
            if (nextBillingDate.getDate() !== dayOfMonth) {
              nextBillingDate.setDate(0); // Go to last day of previous month
            }

            currentPeriodEnd = new Date(nextBillingDate);
          }

          console.log('Recurring booking calculation:', {
            bookingDate: bookingDate.toISOString(),
            interval: repeatBooking,
            normalizedInterval: normalizedRepeatBooking,
            nextBillingDate: nextBillingDate.toISOString(),
            currentPeriodEnd: currentPeriodEnd.toISOString(),
            dayOfWeek: normalizedRepeatBooking === 'weekly' ? dayOfWeek : null,
            dayOfMonth: normalizedRepeatBooking === 'monthly' ? dayOfMonth : null
          });

          const subscription = await prisma.subscription.create({
            data: {
              userId,
              fieldId,
              stripeSubscriptionId: paymentIntent.id, // Use payment intent ID as reference
              stripeCustomerId: user.stripeCustomerId || '',
              status: 'active',
              interval: normalizedRepeatBooking,
              intervalCount: 1,
              currentPeriodStart: bookingDate,
              currentPeriodEnd: currentPeriodEnd,
              timeSlot,
              dayOfWeek: normalizedRepeatBooking === 'weekly' ? dayOfWeek : null,
              dayOfMonth: normalizedRepeatBooking === 'monthly' ? dayOfMonth : null,
              startTime: startTimeStr,
              endTime: endTimeStr,
              numberOfDogs: parseInt(numberOfDogs),
              totalPrice: amount,
              nextBillingDate: nextBillingDate,
              lastBookingDate: bookingDate
            }
          });

          subscriptionId = subscription.id;
          console.log('Created subscription for recurring booking:', subscriptionId);
        } catch (subscriptionError) {
          console.error('Error creating subscription:', subscriptionError);
          // Continue with booking creation even if subscription fails
        }
      }

      const booking = await prisma.booking.create({
        data: {
          fieldId,
          userId,
          date: new Date(date),
          startTime: startTimeStr,
          endTime: endTimeStr,
          timeSlot,
          numberOfDogs: parseInt(numberOfDogs),
          totalPrice: amount,
          platformCommission: platformCommission,
          fieldOwnerAmount,
          status: bookingStatus,
          paymentStatus: paymentStatus,
          paymentIntentId: paymentIntent.id,
          payoutStatus,
          payoutHeldReason,
          repeatBooking: normalizedRepeatBooking || repeatBooking || 'none',
          subscriptionId: subscriptionId // Link to subscription if created
        }
      });

      // If payment was auto-confirmed with saved card, create notifications
      if (paymentIntent.status === 'succeeded') {
        // Create payment record
        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            userId,
            amount,
            currency: 'EUR',
            status: 'completed',
            paymentMethod: 'card',
            stripePaymentId: paymentIntent.id,
            processedAt: new Date()
          }
        });

        // Send notifications
        await createNotification({
          userId,
          type: 'BOOKING_CONFIRMATION',
          title: 'Booking Confirmed',
          message: `Your booking for ${field.name} on ${date} at ${timeSlot} has been confirmed.`,
          data: { bookingId: booking.id, fieldId }
        });

        if (field.ownerId && field.ownerId !== userId) {
          await createNotification({
            userId: field.ownerId,
            type: 'NEW_BOOKING',
            title: 'New Booking',
            message: `You have a new booking for ${field.name} on ${date} at ${timeSlot}.`,
            data: { bookingId: booking.id, fieldId }
          });
        }

        // Send email notifications
        try {
          // Get field owner details for email
          const fieldOwner = await prisma.user.findUnique({
            where: { id: field.ownerId },
            select: { name: true, email: true }
          });

          // Send booking confirmation email to dog owner
          if (user.email) {
            await emailService.sendBookingConfirmationToDogOwner({
              email: user.email,
              userName: user.name || 'Valued Customer',
              bookingId: booking.id,
              fieldName: field.name,
              fieldAddress: field.address || '',
              date: new Date(date),
              startTime: startTimeStr,
              endTime: endTimeStr,
              totalPrice: amount,
              fieldOwnerName: fieldOwner?.name || 'Field Owner'
            });
          }

          // Send new booking notification email to field owner
          if (fieldOwner?.email) {
            await emailService.sendNewBookingNotificationToFieldOwner({
              email: fieldOwner.email,
              ownerName: fieldOwner.name || 'Field Owner',
              bookingId: booking.id,
              fieldName: field.name,
              date: new Date(date),
              startTime: startTimeStr,
              endTime: endTimeStr,
              totalPrice: amount,
              fieldOwnerAmount,
              platformCommission,
              dogOwnerName: user.name || user.email || 'Customer'
            });
          }
        } catch (emailError) {
          console.error('Error sending booking emails:', emailError);
          // Don't fail the booking if email fails
        }
      }

      res.json({
        clientSecret: paymentIntent.client_secret,
        bookingId: booking.id,
        paymentSucceeded: paymentIntent.status === 'succeeded',
        publishableKey: `pk_test_${process.env.STRIPE_SECRET_KEY?.slice(8, 40)}` // Send publishable key
      });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ 
        error: 'Failed to create payment intent',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Confirm payment and update booking status
  async confirmPayment(req: Request, res: Response) {
    try {
      const { paymentIntentId, bookingId } = req.body;

      // Retrieve the payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        // Update booking status
        const booking = await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CONFIRMED',
            paymentStatus: 'PAID'
          },
          include: {
            field: true,
            user: true
          }
        });

        // Get field owner details first
        const field = await prisma.field.findUnique({
          where: { id: booking.fieldId },
          include: {
            owner: true
          }
        });

        // Calculate commission amounts
        const { fieldOwnerAmount, platformFeeAmount, commissionRate } = await calculatePayoutAmounts(
          booking.totalPrice,
          field?.ownerId || ''
        );

        // Create transaction record with commission details
        await prisma.transaction.create({
          data: {
            bookingId: booking.id,
            userId: booking.userId,
            amount: booking.totalPrice,
            netAmount: fieldOwnerAmount,
            platformFee: platformFeeAmount,
            commissionRate: commissionRate,
            type: 'PAYMENT',
            status: 'COMPLETED',
            stripePaymentIntentId: paymentIntentId
          }
        });

        // Send notification to field owner about new booking (also notifies admins)
        if (field?.ownerId && field.ownerId !== booking.userId) {
          const bookingDateLabel = new Date(booking.date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
          const bookingTimeLabel = `${booking.startTime} - ${booking.endTime}`;
          const customerName = booking.user.name || booking.user.email || 'A dog owner';
          const amountDisplay = typeof booking.totalPrice === 'number'
            ? booking.totalPrice.toFixed(2)
            : booking.totalPrice;

          await NotificationService.createNotification({
            userId: field.ownerId,
            type: 'booking_received',
            title: 'New Booking Received!',
            message: `You have a new booking for ${field.name} on ${new Date(booking.date).toLocaleDateString()} at ${booking.startTime}`,
            adminTitle: 'New booking scheduled',
            adminMessage: `${customerName} booked "${field.name}" for ${bookingDateLabel} at ${bookingTimeLabel}. Total £${amountDisplay}.`,
            data: {
              bookingId: booking.id,
              fieldId: booking.fieldId,
              fieldName: field.name,
              date: booking.date,
              time: `${booking.startTime} - ${booking.endTime}`,
              customerName: booking.user.name || booking.user.email,
              numberOfDogs: booking.numberOfDogs,
              amount: booking.totalPrice
            }
          }, true); // true = also notify admins
        }

        // Send confirmation notification to dog owner
        await createNotification({
          userId: booking.userId,
          type: 'booking_confirmed',
          title: 'Booking Confirmed!',
          message: `Your booking for ${field?.name || 'the field'} on ${new Date(booking.date).toLocaleDateString()} at ${booking.startTime} has been confirmed.`,
          data: {
            bookingId: booking.id,
            fieldId: booking.fieldId,
            fieldName: field?.name,
            date: booking.date,
            time: `${booking.startTime} - ${booking.endTime}`,
            amount: booking.totalPrice,
            paymentIntentId
          }
        });

        // Send confirmation email (implement email service)
        // await emailService.sendBookingConfirmation(booking);

        res.json({
          success: true,
          booking,
          message: 'Payment confirmed successfully'
        });
      } else {
        res.status(400).json({
          error: 'Payment not successful',
          status: paymentIntent.status
        });
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      res.status(500).json({ 
        error: 'Failed to confirm payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Handle Stripe webhooks
  async handleWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          
          // Use transaction to prevent duplicate booking updates
          await prisma.$transaction(async (tx) => {
            // Check if booking exists
            const booking = await tx.booking.findFirst({
              where: { paymentIntentId: paymentIntent.id }
            });

            if (!booking) {
              // If no booking exists with this payment intent ID, check metadata
              // This handles edge cases where webhook arrives before booking creation
              const metadata = paymentIntent.metadata;
              if (metadata.userId && metadata.fieldId && metadata.date && metadata.timeSlot) {
                // Check if a booking already exists for this exact combination
                const existingBooking = await tx.booking.findFirst({
                  where: {
                    userId: metadata.userId,
                    fieldId: metadata.fieldId,
                    date: new Date(metadata.date),
                    timeSlot: metadata.timeSlot,
                    status: {
                      notIn: ['CANCELLED']
                    }
                  }
                });

                if (existingBooking) {
                  console.log('Webhook: Duplicate booking prevented for payment intent:', paymentIntent.id);
                  // Update existing booking's payment intent if needed
                  if (!existingBooking.paymentIntentId) {
                    await tx.booking.update({
                      where: { id: existingBooking.id },
                      data: {
                        paymentIntentId: paymentIntent.id,
                        status: 'CONFIRMED',
                        paymentStatus: 'PAID'
                      }
                    });
                  }
                  return; // Exit early to prevent duplicate
                }

                // Create new booking from webhook if it doesn't exist
                const [startTimeStr, endTimeStr] = metadata.timeSlot.split(' - ').map((t: string) => t.trim());
                const platformCommission = parseFloat(metadata.platformCommission || '0');
                const fieldOwnerAmount = parseFloat(metadata.fieldOwnerAmount || '0');
                
                const newBooking = await tx.booking.create({
                  data: {
                    fieldId: metadata.fieldId,
                    userId: metadata.userId,
                    date: new Date(metadata.date),
                    startTime: startTimeStr,
                    endTime: endTimeStr,
                    timeSlot: metadata.timeSlot,
                    numberOfDogs: parseInt(metadata.numberOfDogs || '1'),
                    totalPrice: paymentIntent.amount / 100, // Convert from cents
                    platformCommission,
                    fieldOwnerAmount,
                    status: 'CONFIRMED',
                    paymentStatus: 'PAID',
                    paymentIntentId: paymentIntent.id,
                    payoutStatus: 'PENDING',
                    repeatBooking: metadata.repeatBooking || 'none'
                  }
                });

                // Get field owner for commission calculation
                const field = await tx.field.findUnique({
                  where: { id: metadata.fieldId },
                  select: { ownerId: true }
                });

                // Calculate commission amounts
                const payoutAmounts = await calculatePayoutAmounts(
                  paymentIntent.amount / 100,
                  field?.ownerId || ''
                );

                // Create transaction record with commission details
                await tx.transaction.create({
                  data: {
                    bookingId: newBooking.id,
                    userId: metadata.userId,
                    amount: paymentIntent.amount / 100,
                    netAmount: payoutAmounts.fieldOwnerAmount,
                    platformFee: payoutAmounts.platformFeeAmount,
                    commissionRate: payoutAmounts.commissionRate,
                    type: 'PAYMENT',
                    status: 'COMPLETED',
                    stripePaymentIntentId: paymentIntent.id
                  }
                });

                console.log('Webhook: Created new booking from payment intent:', newBooking.id);
              }
            } else if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'PAID') {
              // Update existing booking status
              await tx.booking.update({
                where: { id: booking.id },
                data: {
                  status: 'CONFIRMED',
                  paymentStatus: 'PAID'
                }
              });

              // Check if transaction already exists
              const existingTransaction = await tx.transaction.findFirst({
                where: {
                  stripePaymentIntentId: paymentIntent.id
                }
              });

              if (!existingTransaction) {
                // Get field for commission calculation
                const field = await tx.field.findUnique({
                  where: { id: booking.fieldId },
                  select: { ownerId: true }
                });

                // Calculate commission amounts
                const payoutAmounts = await calculatePayoutAmounts(
                  booking.totalPrice,
                  field?.ownerId || ''
                );

                // Create transaction record with commission details
                await tx.transaction.create({
                  data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    amount: booking.totalPrice,
                    netAmount: payoutAmounts.fieldOwnerAmount,
                    platformFee: payoutAmounts.platformFeeAmount,
                    commissionRate: payoutAmounts.commissionRate,
                    type: 'PAYMENT',
                    status: 'COMPLETED',
                    stripePaymentIntentId: paymentIntent.id
                  }
                });
              }
            }
          });
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          
          // Update booking status to failed
          const failedBooking = await prisma.booking.findFirst({
            where: { paymentIntentId: failedPayment.id }
          });

          if (failedBooking) {
            await prisma.booking.update({
              where: { id: failedBooking.id },
              data: {
                status: 'CANCELLED',
                paymentStatus: 'FAILED'
              }
            });
          }
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Get payment methods for user
  async getPaymentMethods(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      // For now, return mock data
      // In production, integrate with Stripe Customer API
      res.json({
        paymentMethods: []
      });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
  }
}
