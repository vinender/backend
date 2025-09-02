import { Request, Response } from 'express';
import { stripe } from '../config/stripe.config';
import prisma from '../config/database';
import Stripe from 'stripe';
import { createNotification } from './notification.controller';

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
        where: { id: userId }
      });

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

      // Prepare payment intent parameters
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          userId,
          fieldId,
          numberOfDogs: numberOfDogs.toString(),
          date,
          timeSlot,
          repeatBooking: repeatBooking || 'none',
          type: 'field_booking'
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

      // Create payment intent with error handling
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
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
          status: bookingStatus,
          paymentStatus: paymentStatus,
          paymentIntentId: paymentIntent.id,
          repeatBooking: repeatBooking || 'none'
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
            currency: 'USD',
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

        // Create transaction record
        await prisma.transaction.create({
          data: {
            bookingId: booking.id,
            userId: booking.userId,
            amount: booking.totalPrice,
            type: 'PAYMENT',
            status: 'COMPLETED',
            stripePaymentIntentId: paymentIntentId
          }
        });

        // Get field owner details
        const field = await prisma.field.findUnique({
          where: { id: booking.fieldId },
          include: {
            owner: true
          }
        });

        // Send notification to field owner about new booking
        if (field?.ownerId && field.ownerId !== booking.userId) {
          await createNotification({
            userId: field.ownerId,
            type: 'new_booking_received',
            title: 'New Booking Received!',
            message: `You have a new booking for ${field.name} on ${new Date(booking.date).toLocaleDateString()} at ${booking.startTime}`,
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
          });
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
          
          // Update booking based on payment intent ID
          const booking = await prisma.booking.findFirst({
            where: { paymentIntentId: paymentIntent.id }
          });

          if (booking) {
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                status: 'CONFIRMED',
                paymentStatus: 'PAID'
              }
            });

            // Create transaction record
            await prisma.transaction.create({
              data: {
                bookingId: booking.id,
                userId: booking.userId,
                amount: booking.totalPrice,
                type: 'PAYMENT',
                status: 'COMPLETED',
                stripePaymentIntentId: paymentIntent.id
              }
            });
          }
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