"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
const notification_controller_1 = require("./notification.controller");
class ReviewController {
    // Get all reviews for a field with pagination
    async getFieldReviews(req, res) {
        try {
            const { fieldId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const sortBy = req.query.sortBy || 'recent';
            const rating = req.query.rating ? parseInt(req.query.rating) : undefined;
            const skip = (page - 1) * limit;
            // Build where clause
            const where = { fieldId };
            if (rating) {
                where.rating = rating;
            }
            // Build order by clause
            let orderBy = { createdAt: 'desc' };
            if (sortBy === 'helpful') {
                orderBy = { helpfulCount: 'desc' };
            }
            else if (sortBy === 'rating_high') {
                orderBy = { rating: 'desc' };
            }
            else if (sortBy === 'rating_low') {
                orderBy = { rating: 'asc' };
            }
            // Get reviews with user info
            const [reviews, total] = await Promise.all([
                database_1.default.fieldReview.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                    },
                }),
                database_1.default.fieldReview.count({ where }),
            ]);
            // Get rating distribution
            const ratingDistribution = await database_1.default.fieldReview.groupBy({
                by: ['rating'],
                where: { fieldId },
                _count: {
                    rating: true,
                },
            });
            // Calculate average rating
            const avgRating = await database_1.default.fieldReview.aggregate({
                where: { fieldId },
                _avg: {
                    rating: true,
                },
                _count: {
                    rating: true,
                },
            });
            res.json({
                success: true,
                data: {
                    reviews,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                    stats: {
                        averageRating: avgRating._avg.rating || 0,
                        totalReviews: avgRating._count.rating,
                        ratingDistribution: ratingDistribution.reduce((acc, item) => {
                            acc[item.rating] = item._count.rating;
                            return acc;
                        }, {}),
                    },
                },
            });
        }
        catch (error) {
            console.error('Error fetching field reviews:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch reviews',
            });
        }
    }
    // Create a new review
    async createReview(req, res) {
        try {
            const { fieldId } = req.params;
            const userId = req.user?.id;
            const { rating, title, comment, images = [] } = req.body;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }
            // Check if user already reviewed this field
            const existingReview = await database_1.default.fieldReview.findFirst({
                where: {
                    fieldId,
                    userId,
                },
            });
            if (existingReview) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already reviewed this field',
                });
            }
            // Check if user has booked this field
            const hasBooked = await database_1.default.booking.findFirst({
                where: {
                    fieldId,
                    userId,
                    status: 'COMPLETED',
                },
            });
            // Get user info for denormalization
            const user = await database_1.default.user.findUnique({
                where: { id: userId },
                select: { name: true, image: true },
            });
            // Create the review
            const review = await database_1.default.fieldReview.create({
                data: {
                    fieldId,
                    userId,
                    userName: user?.name,
                    userImage: user?.image,
                    rating,
                    title,
                    comment,
                    images,
                    verified: !!hasBooked,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
            });
            // Send notification to field owner
            console.log('Looking for field:', fieldId);
            const field = await database_1.default.field.findUnique({
                where: { id: fieldId },
                select: { ownerId: true, name: true },
            });
            console.log('Field found:', field);
            if (field?.ownerId) {
                console.log('Sending notification to field owner:', field.ownerId);
                const notificationResult = await (0, notification_controller_1.createNotification)({
                    userId: field.ownerId,
                    type: 'review_posted',
                    title: 'New Review Posted',
                    message: `${user?.name || 'A user'} has posted a ${rating} star review for ${field.name}`,
                    data: {
                        reviewId: review.id,
                        fieldId,
                        fieldName: field.name,
                        rating,
                        reviewerName: user?.name,
                    },
                });
                console.log('Notification result:', notificationResult);
            }
            else {
                console.log('Field owner not found or field does not have an owner');
            }
            res.status(201).json({
                success: true,
                data: review,
            });
        }
        catch (error) {
            console.error('Error creating review:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create review',
            });
        }
    }
    // Update a review
    async updateReview(req, res) {
        try {
            const { reviewId } = req.params;
            const userId = req.user?.id;
            const { rating, title, comment, images } = req.body;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }
            // Check if review exists and belongs to user
            const review = await database_1.default.fieldReview.findFirst({
                where: {
                    id: reviewId,
                    userId,
                },
            });
            if (!review) {
                return res.status(404).json({
                    success: false,
                    message: 'Review not found or you do not have permission to edit it',
                });
            }
            // Update the review
            const updatedReview = await database_1.default.fieldReview.update({
                where: { id: reviewId },
                data: {
                    rating,
                    title,
                    comment,
                    images,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
            });
            res.json({
                success: true,
                data: updatedReview,
            });
        }
        catch (error) {
            console.error('Error updating review:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update review',
            });
        }
    }
    // Delete a review
    async deleteReview(req, res) {
        try {
            const { reviewId } = req.params;
            const userId = req.user?.id;
            const userRole = req.user?.role;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }
            // Check if review exists
            const review = await database_1.default.fieldReview.findUnique({
                where: { id: reviewId },
            });
            if (!review) {
                return res.status(404).json({
                    success: false,
                    message: 'Review not found',
                });
            }
            // Check permission (owner or admin can delete)
            if (review.userId !== userId && userRole !== 'ADMIN') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to delete this review',
                });
            }
            // Delete the review
            await database_1.default.fieldReview.delete({
                where: { id: reviewId },
            });
            res.json({
                success: true,
                message: 'Review deleted successfully',
            });
        }
        catch (error) {
            console.error('Error deleting review:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete review',
            });
        }
    }
    // Mark review as helpful
    async markHelpful(req, res) {
        try {
            const { reviewId } = req.params;
            // Increment helpful count
            const review = await database_1.default.fieldReview.update({
                where: { id: reviewId },
                data: {
                    helpfulCount: {
                        increment: 1,
                    },
                },
            });
            res.json({
                success: true,
                data: review,
            });
        }
        catch (error) {
            console.error('Error marking review as helpful:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark review as helpful',
            });
        }
    }
    // Field owner response to review
    async respondToReview(req, res) {
        try {
            const { reviewId } = req.params;
            const { response } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }
            // Get the review with field info
            const review = await database_1.default.fieldReview.findUnique({
                where: { id: reviewId },
                include: {
                    field: {
                        select: {
                            ownerId: true,
                        },
                    },
                },
            });
            if (!review) {
                return res.status(404).json({
                    success: false,
                    message: 'Review not found',
                });
            }
            // Check if user is the field owner
            if (review.field.ownerId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Only field owner can respond to reviews',
                });
            }
            // Update review with response
            const updatedReview = await database_1.default.fieldReview.update({
                where: { id: reviewId },
                data: {
                    response,
                    respondedAt: new Date(),
                },
            });
            res.json({
                success: true,
                data: updatedReview,
            });
        }
        catch (error) {
            console.error('Error responding to review:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to respond to review',
            });
        }
    }
    // Get user's reviews
    async getUserReviews(req, res) {
        try {
            const userId = req.params.userId || req.user?.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }
            const [reviews, total] = await Promise.all([
                database_1.default.fieldReview.findMany({
                    where: { userId },
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        field: {
                            select: {
                                id: true,
                                name: true,
                                images: true,
                                city: true,
                                state: true,
                            },
                        },
                    },
                }),
                database_1.default.fieldReview.count({ where: { userId } }),
            ]);
            res.json({
                success: true,
                data: {
                    reviews,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            });
        }
        catch (error) {
            console.error('Error fetching user reviews:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user reviews',
            });
        }
    }
}
exports.default = new ReviewController();
