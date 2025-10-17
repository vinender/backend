"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionService = exports.SubscriptionService = void 0;
//@ts-nocheck
const stripe_config_1 = require("../config/stripe.config");
const database_1 = __importDefault(require("../config/database"));
const notification_controller_1 = require("../controllers/notification.controller");
const date_fns_1 = require("date-fns");
class SubscriptionService {
    /**
     * Create a Stripe subscription for recurring bookings
     */
    async createSubscription({ userId, fieldId, date, timeSlot, startTime, endTime, numberOfDogs, repeatBooking, amount, paymentMethodId, customerEmail }) {
        // Get user and field
        const [user, field] = await Promise.all([
            database_1.default.user.findUnique({ where: { id: userId } }),
            database_1.default.field.findUnique({ where: { id: fieldId } })
        ]);
        if (!user || !field) {
            throw new Error('User or field not found');
        }
        // Ensure user has a Stripe customer ID
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe_config_1.stripe.customers.create({
                email: customerEmail,
                name: user.name || undefined,
                metadata: { userId: user.id }
            });
            customerId = customer.id;
            await database_1.default.user.update({
                where: { id: userId },
                data: { stripeCustomerId: customerId }
            });
        }
        // Attach payment method to customer
        await stripe_config_1.stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId
        });
        // Set as default payment method
        await stripe_config_1.stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId
            }
        });
        // Calculate commission
        const PLATFORM_COMMISSION_RATE = 0.20;
        const platformCommission = Math.round(amount * PLATFORM_COMMISSION_RATE * 100) / 100;
        const fieldOwnerAmount = amount - platformCommission;
        // Parse the date to get day of week/month
        const bookingDate = new Date(date);
        const dayOfWeek = (0, date_fns_1.format)(bookingDate, 'EEEE'); // Monday, Tuesday, etc.
        const dayOfMonth = bookingDate.getDate();
        // Create Stripe product for this field
        const product = await stripe_config_1.stripe.products.create({
            name: `${field.name} - ${timeSlot}`,
            metadata: {
                fieldId: field.id,
                fieldName: field.name || '',
                timeSlot,
                numberOfDogs: numberOfDogs.toString()
            }
        });
        // Create price based on interval
        const priceData = {
            product: product.id,
            unit_amount: Math.round(amount * 100), // Convert to cents
            currency: 'eur',
            recurring: {
                interval: repeatBooking === 'weekly' ? 'week' : 'month',
                interval_count: 1
            },
            metadata: {
                fieldId: field.id,
                userId: user.id,
                platformCommission: platformCommission.toString(),
                fieldOwnerAmount: fieldOwnerAmount.toString()
            }
        };
        const price = await stripe_config_1.stripe.prices.create(priceData);
        // Calculate subscription start date (next occurrence)
        let subscriptionStartDate = new Date();
        if (repeatBooking === 'weekly') {
            // Find next occurrence of the selected day
            subscriptionStartDate = this.getNextWeeklyDate(bookingDate);
        }
        else {
            // Monthly - next month on the same date
            subscriptionStartDate = this.getNextMonthlyDate(bookingDate);
        }
        // Create the subscription
        const subscription = await stripe_config_1.stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: price.id }],
            metadata: {
                userId: user.id,
                fieldId: field.id,
                fieldOwnerId: field.ownerId || '',
                timeSlot,
                startTime,
                endTime,
                numberOfDogs: numberOfDogs.toString(),
                dayOfWeek: repeatBooking === 'weekly' ? dayOfWeek : '',
                dayOfMonth: repeatBooking === 'monthly' ? dayOfMonth.toString() : '',
                interval: repeatBooking,
                platformCommission: platformCommission.toString(),
                fieldOwnerAmount: fieldOwnerAmount.toString()
            },
            payment_behavior: 'default_incomplete',
            payment_settings: {
                save_default_payment_method: 'on_subscription'
            },
            expand: ['latest_invoice.payment_intent']
        });
        // Store subscription in database
        const dbSubscription = await database_1.default.subscription.create({
            data: {
                userId,
                fieldId,
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: customerId,
                status: subscription.status,
                interval: repeatBooking,
                intervalCount: 1,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                timeSlot,
                dayOfWeek: repeatBooking === 'weekly' ? dayOfWeek : null,
                dayOfMonth: repeatBooking === 'monthly' ? dayOfMonth : null,
                startTime,
                endTime,
                numberOfDogs,
                totalPrice: amount,
                nextBillingDate: new Date(subscription.current_period_end * 1000)
            }
        });
        // Create the first booking
        await this.createBookingFromSubscription(dbSubscription.id, bookingDate);
        // Send notification to field owner
        if (field.ownerId && field.ownerId !== userId) {
            await (0, notification_controller_1.createNotification)({
                userId: field.ownerId,
                type: 'recurring_booking_created',
                title: 'New Recurring Booking!',
                message: `A ${repeatBooking} recurring booking has been set up for ${field.name} starting ${(0, date_fns_1.format)(bookingDate, 'PPP')} at ${timeSlot}`,
                data: {
                    subscriptionId: dbSubscription.id,
                    fieldId: field.id,
                    fieldName: field.name,
                    interval: repeatBooking
                }
            });
        }
        return {
            subscription: dbSubscription,
            stripeSubscription: subscription,
            clientSecret: subscription.latest_invoice?.payment_intent?.client_secret
        };
    }
    /**
     * Create a booking from a subscription
     */
    async createBookingFromSubscription(subscriptionId, bookingDate) {
        const subscription = await database_1.default.subscription.findUnique({
            where: { id: subscriptionId },
            include: { field: true }
        });
        if (!subscription) {
            throw new Error('Subscription not found');
        }
        // Calculate price based on field duration
        const { field } = subscription;
        const pricePerUnit = field.price || 0;
        const [startHour, startMin] = subscription.startTime.split(':').map(Number);
        const [endHour, endMin] = subscription.endTime.split(':').map(Number);
        const durationHours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
        let totalPrice = 0;
        if (field.bookingDuration === '30min') {
            const duration30MinBlocks = durationHours * 2;
            totalPrice = pricePerUnit * duration30MinBlocks * subscription.numberOfDogs;
        }
        else {
            totalPrice = pricePerUnit * durationHours * subscription.numberOfDogs;
        }
        // Get field owner for snapshot
        const fieldOwner = await database_1.default.user.findUnique({
            where: { id: field.ownerId },
            select: { name: true, email: true }
        });
        // Create booking with field snapshot
        const booking = await database_1.default.booking.create({
            data: {
                userId: subscription.userId,
                fieldId: subscription.fieldId,
                date: bookingDate,
                startTime: this.formatTimeForBooking(subscription.startTime),
                endTime: this.formatTimeForBooking(subscription.endTime),
                timeSlot: subscription.timeSlot,
                numberOfDogs: subscription.numberOfDogs,
                totalPrice,
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                repeatBooking: subscription.interval,
                subscriptionId: subscription.id,
                platformCommission: totalPrice * 0.20,
                fieldOwnerAmount: totalPrice * 0.80
            }
        });
        // Update subscription last booking date
        await database_1.default.subscription.update({
            where: { id: subscriptionId },
            data: { lastBookingDate: bookingDate }
        });
        return booking;
    }
    /**
     * Handle subscription webhook events from Stripe
     */
    async handleSubscriptionWebhook(event) {
        switch (event.type) {
            case 'invoice.payment_succeeded':
                await this.handleInvoicePaymentSucceeded(event.data.object);
                break;
            case 'invoice.payment_failed':
                await this.handleInvoicePaymentFailed(event.data.object);
                break;
            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdated(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object);
                break;
        }
    }
    /**
     * Handle successful invoice payment (create next booking)
     */
    async handleInvoicePaymentSucceeded(invoice) {
        if (!invoice.subscription)
            return;
        const subscription = await database_1.default.subscription.findUnique({
            where: { stripeSubscriptionId: invoice.subscription },
            include: { field: true }
        });
        if (!subscription)
            return;
        // Get system settings for max advance booking days
        const settings = await database_1.default.systemSettings.findFirst({
            select: { maxAdvanceBookingDays: true }
        });
        const maxAdvanceBookingDays = settings?.maxAdvanceBookingDays || 30;
        // Calculate next booking date
        let nextBookingDate = new Date();
        if (subscription.interval === 'everyday') {
            // Next day
            nextBookingDate = (0, date_fns_1.addDays)(subscription.lastBookingDate || new Date(), 1);
        }
        else if (subscription.interval === 'weekly') {
            // Next week on the same day
            nextBookingDate = (0, date_fns_1.addDays)(subscription.lastBookingDate || new Date(), 7);
        }
        else {
            // Next month on the same date
            nextBookingDate = (0, date_fns_1.addMonths)(subscription.lastBookingDate || new Date(), 1);
        }
        // Validate that next booking date is within advance booking days range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxFutureDate = new Date(today);
        maxFutureDate.setDate(maxFutureDate.getDate() + maxAdvanceBookingDays);
        // Only create booking if it falls within the advance booking range
        if (nextBookingDate > maxFutureDate) {
            console.log(`⏭️  Next booking date (${(0, date_fns_1.format)(nextBookingDate, 'PPP')}) is beyond max advance booking days (${maxAdvanceBookingDays}) for subscription ${subscription.id}`);
            // Notify user that booking will be created closer to the date
            await (0, notification_controller_1.createNotification)({
                userId: subscription.userId,
                type: 'recurring_booking_pending',
                title: 'Recurring Booking Scheduled',
                message: `Your ${subscription.interval} booking payment was successful. The booking will be automatically created closer to ${(0, date_fns_1.format)(nextBookingDate, 'PPP')} at ${subscription.timeSlot}`,
                data: {
                    subscriptionId: subscription.id,
                    nextBookingDate: nextBookingDate.toISOString(),
                    fieldName: subscription.field?.name
                }
            });
            return;
        }
        // Create the booking for the next period
        await this.createBookingFromSubscription(subscription.id, nextBookingDate);
        // Send notification to user
        await (0, notification_controller_1.createNotification)({
            userId: subscription.userId,
            type: 'recurring_booking_charged',
            title: 'Recurring Booking Renewed',
            message: `Your ${subscription.interval} booking has been renewed. Next booking: ${(0, date_fns_1.format)(nextBookingDate, 'PPP')} at ${subscription.timeSlot}`,
            data: {
                subscriptionId: subscription.id,
                nextBookingDate: nextBookingDate.toISOString()
            }
        });
    }
    /**
     * Handle failed invoice payment
     */
    async handleInvoicePaymentFailed(invoice) {
        if (!invoice.subscription)
            return;
        const subscription = await database_1.default.subscription.findUnique({
            where: { stripeSubscriptionId: invoice.subscription }
        });
        if (!subscription)
            return;
        // Update subscription status
        await database_1.default.subscription.update({
            where: { id: subscription.id },
            data: { status: 'past_due' }
        });
        // Send notification to user
        await (0, notification_controller_1.createNotification)({
            userId: subscription.userId,
            type: 'payment_failed',
            title: 'Payment Failed',
            message: 'Your recurring booking payment failed. Please update your payment method to continue.',
            data: {
                subscriptionId: subscription.id
            }
        });
    }
    /**
     * Handle subscription updates from Stripe
     */
    async handleSubscriptionUpdated(stripeSubscription) {
        await database_1.default.subscription.update({
            where: { stripeSubscriptionId: stripeSubscription.id },
            data: {
                status: stripeSubscription.status,
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
                canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null
            }
        });
    }
    /**
     * Handle subscription deletion
     */
    async handleSubscriptionDeleted(stripeSubscription) {
        const subscription = await database_1.default.subscription.update({
            where: { stripeSubscriptionId: stripeSubscription.id },
            data: {
                status: 'canceled',
                canceledAt: new Date()
            }
        });
        // Send notification to user
        await (0, notification_controller_1.createNotification)({
            userId: subscription.userId,
            type: 'subscription_canceled',
            title: 'Recurring Booking Cancelled',
            message: 'Your recurring booking has been cancelled.',
            data: {
                subscriptionId: subscription.id
            }
        });
    }
    /**
     * Cancel a subscription
     */
    async cancelSubscription(subscriptionId, cancelImmediately = false) {
        const subscription = await database_1.default.subscription.findUnique({
            where: { id: subscriptionId }
        });
        if (!subscription) {
            throw new Error('Subscription not found');
        }
        // Cancel in Stripe
        const stripeSubscription = await stripe_config_1.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: !cancelImmediately
        });
        if (cancelImmediately) {
            await stripe_config_1.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        }
        // Update in database
        await database_1.default.subscription.update({
            where: { id: subscriptionId },
            data: {
                cancelAtPeriodEnd: !cancelImmediately,
                status: cancelImmediately ? 'canceled' : subscription.status,
                canceledAt: cancelImmediately ? new Date() : null
            }
        });
        return stripeSubscription;
    }
    /**
     * Get next weekly occurrence of a date
     */
    getNextWeeklyDate(date) {
        return (0, date_fns_1.addDays)(date, 7);
    }
    /**
     * Get next monthly occurrence of a date
     */
    getNextMonthlyDate(date) {
        return (0, date_fns_1.addMonths)(date, 1);
    }
    /**
     * Format time for booking (e.g., "08:00" to "8:00AM")
     */
    formatTimeForBooking(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
    }
}
exports.SubscriptionService = SubscriptionService;
exports.subscriptionService = new SubscriptionService();
