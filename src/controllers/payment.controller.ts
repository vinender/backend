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
        amount
      } = req.body;

      // Validate user
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
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

      // Create payment intent with metadata
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
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
      });

      // Parse the time slot to extract start and end times
      // Expected format: "4:00PM - 5:00PM"
      const [startTimeStr, endTimeStr] = timeSlot.split(' - ').map(t => t.trim());
      
      // Create a pending booking record
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
          status: 'PENDING',
          paymentIntentId: paymentIntent.id,
          repeatBooking: repeatBooking || 'none'
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        bookingId: booking.id,
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