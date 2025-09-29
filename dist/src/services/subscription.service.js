"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get SubscriptionService () {
        return SubscriptionService;
    },
    get subscriptionService () {
        return subscriptionService;
    }
});
const _stripeconfig = require("../config/stripe.config");
const _database = /*#__PURE__*/ _interop_require_default(require("../config/database"));
const _notificationcontroller = require("../controllers/notification.controller");
const _datefns = require("date-fns");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class SubscriptionService {
    /**
   * Create a Stripe subscription for recurring bookings
   */ async createSubscription({ userId, fieldId, date, timeSlot, startTime, endTime, numberOfDogs, repeatBooking, amount, paymentMethodId, customerEmail }) {
        // Get user and field
        const [user, field] = await Promise.all([
            _database.default.user.findUnique({
                where: {
                    id: userId
                }
            }),
            _database.default.field.findUnique({
                where: {
                    id: fieldId
                }
            })
        ]);
        if (!user || !field) {
            throw new Error('User or field not found');
        }
        // Ensure user has a Stripe customer ID
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await _stripeconfig.stripe.customers.create({
                email: customerEmail,
                name: user.name || undefined,
                metadata: {
                    userId: user.id
                }
            });
            customerId = customer.id;
            await _database.default.user.update({
                where: {
                    id: userId
                },
                data: {
                    stripeCustomerId: customerId
                }
            });
        }
        // Attach payment method to customer
        await _stripeconfig.stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId
        });
        // Set as default payment method
        await _stripeconfig.stripe.customers.update(customerId, {
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
        const dayOfWeek = (0, _datefns.format)(bookingDate, 'EEEE'); // Monday, Tuesday, etc.
        const dayOfMonth = bookingDate.getDate();
        // Create Stripe product for this field
        const product = await _stripeconfig.stripe.products.create({
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
            unit_amount: Math.round(amount * 100),
            currency: 'usd',
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
        const price = await _stripeconfig.stripe.prices.create(priceData);
        // Calculate subscription start date (next occurrence)
        let subscriptionStartDate = new Date();
        if (repeatBooking === 'weekly') {
            // Find next occurrence of the selected day
            subscriptionStartDate = this.getNextWeeklyDate(bookingDate);
        } else {
            // Monthly - next month on the same date
            subscriptionStartDate = this.getNextMonthlyDate(bookingDate);
        }
        // Create the subscription
        const subscription = await _stripeconfig.stripe.subscriptions.create({
            customer: customerId,
            items: [
                {
                    price: price.id
                }
            ],
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
            expand: [
                'latest_invoice.payment_intent'
            ]
        });
        // Store subscription in database
        const dbSubscription = await _database.default.subscription.create({
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
            await (0, _notificationcontroller.createNotification)({
                userId: field.ownerId,
                type: 'recurring_booking_created',
                title: 'New Recurring Booking!',
                message: `A ${repeatBooking} recurring booking has been set up for ${field.name} starting ${(0, _datefns.format)(bookingDate, 'PPP')} at ${timeSlot}`,
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
   */ async createBookingFromSubscription(subscriptionId, bookingDate) {
        const subscription = await _database.default.subscription.findUnique({
            where: {
                id: subscriptionId
            },
            include: {
                field: true
            }
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
        } else {
            totalPrice = pricePerUnit * durationHours * subscription.numberOfDogs;
        }
        // Create booking
        const booking = await _database.default.booking.create({
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
        await _database.default.subscription.update({
            where: {
                id: subscriptionId
            },
            data: {
                lastBookingDate: bookingDate
            }
        });
        return booking;
    }
    /**
   * Handle subscription webhook events from Stripe
   */ async handleSubscriptionWebhook(event) {
        switch(event.type){
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
   */ async handleInvoicePaymentSucceeded(invoice) {
        if (!invoice.subscription) return;
        const subscription = await _database.default.subscription.findUnique({
            where: {
                stripeSubscriptionId: invoice.subscription
            }
        });
        if (!subscription) return;
        // Calculate next booking date
        let nextBookingDate = new Date();
        if (subscription.interval === 'weekly') {
            // Next week on the same day
            nextBookingDate = (0, _datefns.addDays)(subscription.lastBookingDate || new Date(), 7);
        } else {
            // Next month on the same date
            nextBookingDate = (0, _datefns.addMonths)(subscription.lastBookingDate || new Date(), 1);
        }
        // Create the booking for the next period
        await this.createBookingFromSubscription(subscription.id, nextBookingDate);
        // Send notification to user
        await (0, _notificationcontroller.createNotification)({
            userId: subscription.userId,
            type: 'recurring_booking_charged',
            title: 'Recurring Booking Renewed',
            message: `Your ${subscription.interval} booking has been renewed. Next booking: ${(0, _datefns.format)(nextBookingDate, 'PPP')} at ${subscription.timeSlot}`,
            data: {
                subscriptionId: subscription.id,
                nextBookingDate: nextBookingDate.toISOString()
            }
        });
    }
    /**
   * Handle failed invoice payment
   */ async handleInvoicePaymentFailed(invoice) {
        if (!invoice.subscription) return;
        const subscription = await _database.default.subscription.findUnique({
            where: {
                stripeSubscriptionId: invoice.subscription
            }
        });
        if (!subscription) return;
        // Update subscription status
        await _database.default.subscription.update({
            where: {
                id: subscription.id
            },
            data: {
                status: 'past_due'
            }
        });
        // Send notification to user
        await (0, _notificationcontroller.createNotification)({
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
   */ async handleSubscriptionUpdated(stripeSubscription) {
        await _database.default.subscription.update({
            where: {
                stripeSubscriptionId: stripeSubscription.id
            },
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
   */ async handleSubscriptionDeleted(stripeSubscription) {
        const subscription = await _database.default.subscription.update({
            where: {
                stripeSubscriptionId: stripeSubscription.id
            },
            data: {
                status: 'canceled',
                canceledAt: new Date()
            }
        });
        // Send notification to user
        await (0, _notificationcontroller.createNotification)({
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
   */ async cancelSubscription(subscriptionId, cancelImmediately = false) {
        const subscription = await _database.default.subscription.findUnique({
            where: {
                id: subscriptionId
            }
        });
        if (!subscription) {
            throw new Error('Subscription not found');
        }
        // Cancel in Stripe
        const stripeSubscription = await _stripeconfig.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: !cancelImmediately
        });
        if (cancelImmediately) {
            await _stripeconfig.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        }
        // Update in database
        await _database.default.subscription.update({
            where: {
                id: subscriptionId
            },
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
   */ getNextWeeklyDate(date) {
        return (0, _datefns.addDays)(date, 7);
    }
    /**
   * Get next monthly occurrence of a date
   */ getNextMonthlyDate(date) {
        return (0, _datefns.addMonths)(date, 1);
    }
    /**
   * Format time for booking (e.g., "08:00" to "8:00AM")
   */ formatTimeForBooking(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
    }
}
const subscriptionService = new SubscriptionService();

//# sourceMappingURL=subscription.service.js.map