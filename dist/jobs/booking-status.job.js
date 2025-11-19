"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initBookingStatusJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = __importDefault(require("../config/database"));
/**
 * Job to automatically mark past CONFIRMED bookings as COMPLETED
 * Runs every 15 minutes
 */
const initBookingStatusJob = () => {
    // Schedule task to run every 15 minutes
    node_cron_1.default.schedule('*/15 * * * *', async () => {
        console.log('Running booking status update job...');
        try {
            const now = new Date();
            // Find all CONFIRMED bookings that have ended
            // We need to check both the date and the end time
            // Since end time is a string (e.g., "14:00"), we'll fetch potential candidates first
            // and then filter them in memory or use a more complex query if possible.
            // For simplicity and safety, we'll fetch confirmed bookings from the past few days up to today.
            // 1. Find bookings with date < today (strictly past dates)
            const pastDateBookings = await database_1.default.booking.updateMany({
                where: {
                    status: 'CONFIRMED',
                    date: {
                        lt: new Date(now.setHours(0, 0, 0, 0)) // Strictly less than start of today
                    }
                },
                data: {
                    status: 'COMPLETED'
                }
            });
            if (pastDateBookings.count > 0) {
                console.log(`Updated ${pastDateBookings.count} past bookings to COMPLETED`);
            }
            // 2. Find bookings for TODAY that have ended
            // This requires checking the endTime string
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayBookings = await database_1.default.booking.findMany({
                where: {
                    status: 'CONFIRMED',
                    date: {
                        equals: today
                    }
                },
                select: {
                    id: true,
                    endTime: true
                }
            });
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const bookingsToComplete = todayBookings.filter(booking => {
                if (!booking.endTime)
                    return false;
                const [endHour, endMinute] = booking.endTime.split(':').map(Number);
                // Check if booking end time has passed
                if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMinute)) {
                    return true;
                }
                return false;
            });
            if (bookingsToComplete.length > 0) {
                await database_1.default.booking.updateMany({
                    where: {
                        id: {
                            in: bookingsToComplete.map(b => b.id)
                        }
                    },
                    data: {
                        status: 'COMPLETED'
                    }
                });
                console.log(`Updated ${bookingsToComplete.length} today's bookings to COMPLETED`);
            }
        }
        catch (error) {
            console.error('Error in booking status job:', error);
        }
    });
    console.log('✅ Booking status job initialized');
};
exports.initBookingStatusJob = initBookingStatusJob;
