"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const stripe_config_1 = require("../config/stripe.config");
const database_1 = __importDefault(require("../config/database"));
const notification_controller_1 = require("./notification.controller");
const commission_utils_1 = require("../utils/commission.utils");
const email_service_1 = require("../services/email.service");
class PaymentController {
    // Create a payment intent for booking a field
    async createPaymentIntent(req, res) {
        try {
            const { fieldId, numberOfDogs, date, timeSlot, repeatBooking, amount, paymentMethodId // Optional: use saved payment method
             } = req.body;
            // Validate user
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            // Get user for Stripe customer
            const user = await database_1.default.user.findUnique({
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
                const userBlockStatus = await database_1.default.user.findUnique({
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
            }
            catch (error) {
                // isBlocked field doesn't exist in production yet, skip check
                console.warn('Warning: isBlocked field not found in User model.');
            }
            // Create idempotency key to prevent duplicate bookings
            // Use a unique key for each payment intent attempt
            const crypto = require('crypto');
            const requestId = crypto.randomBytes(16).toString('hex');
            const idempotencyKey = `booking_${userId}_${fieldId}_${date}_${timeSlot}_${requestId}`.replace(/[\s:]/g, '_');
            // Check if a booking already exists for this exact combination
            const existingBooking = await database_1.default.booking.findFirst({
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
                }
                else if (existingBooking.paymentStatus === 'PENDING') {
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
            const field = await database_1.default.field.findUnique({
                where: { id: fieldId }
            });
            if (!field) {
                return res.status(404).json({ error: 'Field not found' });
            }
            // Calculate amount in cents (Stripe uses smallest currency unit)
            const amountInCents = Math.round(amount * 100);
            // Calculate platform commission dynamically using commission utils
            const { fieldOwnerAmount, platformCommission, commissionRate } = await (0, commission_utils_1.calculatePayoutAmounts)(amount, field.ownerId || '');
            // Prepare payment intent parameters
            // Payment goes to platform account (admin) first
            const paymentIntentParams = {
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
                receipt_email: req.user?.email,
            };
            // If a payment method is provided, use it
            if (paymentMethodId) {
                // Verify the payment method belongs to this user
                const paymentMethod = await database_1.default.paymentMethod.findFirst({
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
                        const customer = await stripe_config_1.stripe.customers.retrieve(customerId);
                        if (customer.deleted) {
                            console.log(`Stripe customer ${customerId} was deleted, creating new one`);
                            customerId = null; // Force recreation
                        }
                    }
                    catch (error) {
                        if (error.statusCode === 404 || error.code === 'resource_missing') {
                            console.log(`Stripe customer ${customerId} not found, creating new one`);
                            customerId = null; // Force recreation
                        }
                        else {
                            throw error; // Re-throw other errors
                        }
                    }
                }
                // Create customer if doesn't exist or was invalid
                if (!customerId) {
                    const customer = await stripe_config_1.stripe.customers.create({
                        email: user.email,
                        name: user.name || undefined,
                        metadata: {
                            userId: user.id
                        }
                    });
                    customerId = customer.id;
                    // Save customer ID
                    await database_1.default.user.update({
                        where: { id: userId },
                        data: { stripeCustomerId: customerId }
                    });
                }
                try {
                    // Verify the payment method still exists in Stripe
                    const stripePaymentMethod = await stripe_config_1.stripe.paymentMethods.retrieve(paymentMethod.stripePaymentMethodId);
                    // Check if payment method is attached to the customer
                    if (stripePaymentMethod.customer !== customerId) {
                        // Attach payment method to customer if not already attached
                        await stripe_config_1.stripe.paymentMethods.attach(paymentMethod.stripePaymentMethodId, { customer: customerId });
                    }
                }
                catch (stripeError) {
                    console.error('Stripe payment method error:', stripeError);
                    // Payment method doesn't exist or is invalid
                    if (stripeError.code === 'resource_missing' || stripeError.statusCode === 404) {
                        // Remove invalid payment method from database
                        await database_1.default.paymentMethod.delete({
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
            }
            else {
                // Use automatic payment methods for new card entry
                paymentIntentParams.automatic_payment_methods = {
                    enabled: true,
                };
            }
            // Create payment intent with error handling and idempotency
            let paymentIntent;
            try {
                paymentIntent = await stripe_config_1.stripe.paymentIntents.create(paymentIntentParams, {
                    idempotencyKey: idempotencyKey
                });
            }
            catch (stripeError) {
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
            const fieldOwnerStripeAccount = await database_1.default.stripeAccount.findUnique({
                where: { userId: field.ownerId }
            });
            // Get system settings for payout release schedule
            const systemSettings = await database_1.default.systemSettings.findFirst();
            const payoutReleaseSchedule = systemSettings?.payoutReleaseSchedule || 'after_cancellation_window';
            // Determine payout status based on Stripe account connection and release schedule
            let payoutStatus = 'PENDING';
            let payoutHeldReason = undefined;
            if (paymentIntent.status === 'succeeded') {
                if (!fieldOwnerStripeAccount || !fieldOwnerStripeAccount.chargesEnabled || !fieldOwnerStripeAccount.payoutsEnabled) {
                    // Hold the payout if field owner doesn't have a connected Stripe account
                    payoutStatus = 'HELD';
                    payoutHeldReason = 'NO_STRIPE_ACCOUNT';
                }
                else if (payoutReleaseSchedule === 'immediate') {
                    // Process immediate payout if configured
                    payoutStatus = 'PENDING'; // Will be processed immediately after booking creation
                }
                else if (payoutReleaseSchedule === 'on_weekend') {
                    // Check if today is weekend
                    const today = new Date().getDay();
                    if (today === 5 || today === 6 || today === 0) { // Friday, Saturday, Sunday
                        payoutStatus = 'PENDING';
                    }
                    else {
                        payoutStatus = 'HELD';
                        payoutHeldReason = 'WAITING_FOR_WEEKEND';
                    }
                }
                else { // after_cancellation_window
                    payoutStatus = 'HELD';
                    payoutHeldReason = 'WITHIN_CANCELLATION_WINDOW';
                }
            }
            // Get field owner details for snapshot
            const fieldOwner = await database_1.default.user.findUnique({
                where: { id: field.ownerId },
                select: { name: true, email: true }
            });
            const booking = await database_1.default.booking.create({
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
                    repeatBooking: repeatBooking || 'none'
                }
            });
            // If payment was auto-confirmed with saved card, create notifications
            if (paymentIntent.status === 'succeeded') {
                // Create payment record
                await database_1.default.payment.create({
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
                await (0, notification_controller_1.createNotification)({
                    userId,
                    type: 'BOOKING_CONFIRMATION',
                    title: 'Booking Confirmed',
                    message: `Your booking for ${field.name} on ${date} at ${timeSlot} has been confirmed.`,
                    data: { bookingId: booking.id, fieldId }
                });
                if (field.ownerId && field.ownerId !== userId) {
                    await (0, notification_controller_1.createNotification)({
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
                    const fieldOwner = await database_1.default.user.findUnique({
                        where: { id: field.ownerId },
                        select: { name: true, email: true }
                    });
                    // Send booking confirmation email to dog owner
                    if (user.email) {
                        await email_service_1.emailService.sendBookingConfirmationToDogOwner({
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
                        await email_service_1.emailService.sendNewBookingNotificationToFieldOwner({
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
                }
                catch (emailError) {
                    console.error('Error sending booking emails:', emailError);
                    // Don't fail the booking if email fails
                }
                // Process immediate payout if configured and Stripe account is connected
                if (payoutReleaseSchedule === 'immediate' && fieldOwnerStripeAccount &&
                    fieldOwnerStripeAccount.chargesEnabled && fieldOwnerStripeAccount.payoutsEnabled) {
                    try {
                        console.log(`Processing immediate payout for booking ${booking.id}`);
                        // Create a transfer to the connected account
                        const transfer = await stripe_config_1.stripe.transfers.create({
                            amount: Math.round(fieldOwnerAmount * 100), // Convert to cents
                            currency: 'eur',
                            destination: fieldOwnerStripeAccount.stripeAccountId,
                            transfer_group: `booking_${booking.id}`,
                            metadata: {
                                bookingId: booking.id,
                                fieldId: field.id,
                                fieldOwnerId: field.ownerId,
                                type: 'immediate_booking_payout',
                                processingReason: 'immediate_release_configured'
                            },
                            description: `Immediate payout for booking ${booking.id} - ${field.name}`
                        });
                        // Create payout record in database
                        const payout = await database_1.default.payout.create({
                            data: {
                                stripeAccountId: fieldOwnerStripeAccount.id,
                                stripePayoutId: transfer.id,
                                amount: fieldOwnerAmount,
                                currency: 'eur',
                                status: 'paid',
                                method: 'standard',
                                description: `Immediate payout for booking ${booking.id}`,
                                bookingIds: [booking.id],
                                arrivalDate: new Date()
                            }
                        });
                        // Update booking with payout details
                        await database_1.default.booking.update({
                            where: { id: booking.id },
                            data: {
                                payoutStatus: 'COMPLETED',
                                payoutId: payout.id
                            }
                        });
                        // Notify field owner about immediate payout
                        await (0, notification_controller_1.createNotification)({
                            userId: field.ownerId,
                            type: 'PAYOUT_PROCESSED',
                            title: '💰 Instant Payment Received!',
                            message: `€${fieldOwnerAmount.toFixed(2)} has been instantly transferred to your account for the ${field.name} booking.`,
                            data: {
                                bookingId: booking.id,
                                payoutId: payout.id,
                                amount: fieldOwnerAmount,
                                fieldName: field.name,
                                customerName: user.name || user.email
                            }
                        });
                        console.log(`Immediate payout processed successfully for booking ${booking.id}`);
                    }
                    catch (payoutError) {
                        console.error('Error processing immediate payout:', payoutError);
                        // Don't fail the booking, just log the error
                        // Payout will be retried by the scheduled job
                    }
                }
            }
            res.json({
                clientSecret: paymentIntent.client_secret,
                bookingId: booking.id,
                paymentSucceeded: paymentIntent.status === 'succeeded',
                publishableKey: `pk_test_${process.env.STRIPE_SECRET_KEY?.slice(8, 40)}` // Send publishable key
            });
        }
        catch (error) {
            console.error('Error creating payment intent:', error);
            res.status(500).json({
                error: 'Failed to create payment intent',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    // Confirm payment and update booking status
    async confirmPayment(req, res) {
        try {
            const { paymentIntentId, bookingId } = req.body;
            // Retrieve the payment intent from Stripe
            const paymentIntent = await stripe_config_1.stripe.paymentIntents.retrieve(paymentIntentId);
            if (paymentIntent.status === 'succeeded') {
                // Update booking status
                const booking = await database_1.default.booking.update({
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
                const field = await database_1.default.field.findUnique({
                    where: { id: booking.fieldId },
                    include: {
                        owner: true
                    }
                });
                // Calculate commission amounts
                const { fieldOwnerAmount, platformFeeAmount, commissionRate } = await (0, commission_utils_1.calculatePayoutAmounts)(booking.totalPrice, field?.ownerId || '');
                // Create transaction record with commission details
                await database_1.default.transaction.create({
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
                // Send notification to field owner about new booking
                if (field?.ownerId && field.ownerId !== booking.userId) {
                    await (0, notification_controller_1.createNotification)({
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
                await (0, notification_controller_1.createNotification)({
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
            }
            else {
                res.status(400).json({
                    error: 'Payment not successful',
                    status: paymentIntent.status
                });
            }
        }
        catch (error) {
            console.error('Error confirming payment:', error);
            res.status(500).json({
                error: 'Failed to confirm payment',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    // Handle Stripe webhooks
    async handleWebhook(req, res) {
        const sig = req.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('Stripe webhook secret not configured');
            return res.status(500).json({ error: 'Webhook secret not configured' });
        }
        let event;
        try {
            event = stripe_config_1.stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        }
        catch (err) {
            console.error('Webhook signature verification failed:', err);
            return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        // Handle the event
        try {
            switch (event.type) {
                case 'payment_intent.succeeded':
                    const paymentIntent = event.data.object;
                    // Use transaction to prevent duplicate booking updates
                    await database_1.default.$transaction(async (tx) => {
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
                                const [startTimeStr, endTimeStr] = metadata.timeSlot.split(' - ').map((t) => t.trim());
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
                                const payoutAmounts = await (0, commission_utils_1.calculatePayoutAmounts)(paymentIntent.amount / 100, field?.ownerId || '');
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
                        }
                        else if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'PAID') {
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
                                const payoutAmounts = await (0, commission_utils_1.calculatePayoutAmounts)(booking.totalPrice, field?.ownerId || '');
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
                    const failedPayment = event.data.object;
                    // Update booking status to failed
                    const failedBooking = await database_1.default.booking.findFirst({
                        where: { paymentIntentId: failedPayment.id }
                    });
                    if (failedBooking) {
                        await database_1.default.booking.update({
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
        }
        catch (error) {
            console.error('Error processing webhook:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    }
    // Get payment methods for user
    async getPaymentMethods(req, res) {
        try {
            const userId = req.user?.id;
            // For now, return mock data
            // In production, integrate with Stripe Customer API
            res.json({
                paymentMethods: []
            });
        }
        catch (error) {
            console.error('Error fetching payment methods:', error);
            res.status(500).json({ error: 'Failed to fetch payment methods' });
        }
    }
}
exports.PaymentController = PaymentController;
