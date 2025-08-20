"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_model_1 = __importDefault(require("../models/user.model"));
const asyncHandler_1 = require("../utils/asyncHandler");
const AppError_1 = require("../utils/AppError");
class UserController {
    // Get all users (admin only)
    getAllUsers = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const users = await user_model_1.default.findAll(skip, limit);
        res.json({
            success: true,
            data: users,
            pagination: {
                page,
                limit,
                total: users.length,
            },
        });
    });
    // Get user by ID
    getUser = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const user = await user_model_1.default.findById(id);
        if (!user) {
            throw new AppError_1.AppError('User not found', 404);
        }
        res.json({
            success: true,
            data: user,
        });
    });
    // Update user profile
    updateUser = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const updates = req.body;
        // Check if user is updating their own profile or is admin
        if (req.user.id !== id && req.user.role !== 'ADMIN') {
            throw new AppError_1.AppError('You can only update your own profile', 403);
        }
        // Prevent updating certain fields
        delete updates.id;
        delete updates.email; // Email change should be done through separate verification process
        delete updates.password; // Password change should be done through separate endpoint
        delete updates.role; // Role can only be changed by admin
        const updatedUser = await user_model_1.default.update(id, updates);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser,
        });
    });
    // Delete user (admin only or self)
    deleteUser = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        // Check if user is deleting their own account or is admin
        if (req.user.id !== id && req.user.role !== 'ADMIN') {
            throw new AppError_1.AppError('You can only delete your own account', 403);
        }
        await user_model_1.default.delete(id);
        res.status(204).json({
            success: true,
            message: 'User deleted successfully',
        });
    });
    // Change password
    changePassword = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            throw new AppError_1.AppError('Current password and new password are required', 400);
        }
        const user = await user_model_1.default.findByEmail(req.user.email);
        if (!user || !user.password) {
            throw new AppError_1.AppError('User not found', 404);
        }
        // Verify current password
        const isPasswordValid = await user_model_1.default.verifyPassword(currentPassword, user.password);
        if (!isPasswordValid) {
            throw new AppError_1.AppError('Current password is incorrect', 401);
        }
        // Update password
        await user_model_1.default.update(userId, { password: newPassword });
        res.json({
            success: true,
            message: 'Password changed successfully',
        });
    });
    // Get user stats (for dashboard)
    getUserStats = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const userRole = req.user.role;
        // This would be more complex with actual database queries
        const stats = {
            userId,
            role: userRole,
            ...(userRole === 'DOG_OWNER' && {
                totalBookings: 0,
                upcomingBookings: 0,
                savedFields: 0,
                totalSpent: 0,
            }),
            ...(userRole === 'FIELD_OWNER' && {
                totalFields: 0,
                activeFields: 0,
                totalBookings: 0,
                totalRevenue: 0,
                averageRating: 0,
            }),
        };
        res.json({
            success: true,
            data: stats,
        });
    });
}
exports.default = new UserController();
