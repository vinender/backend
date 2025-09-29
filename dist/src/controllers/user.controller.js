"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _usermodel = /*#__PURE__*/ _interop_require_default(require("../models/user.model"));
const _asyncHandler = require("../utils/asyncHandler");
const _AppError = require("../utils/AppError");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class UserController {
    // Get all users (admin only)
    getAllUsers = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const users = await _usermodel.default.findAll(skip, limit);
        res.json({
            success: true,
            data: users,
            pagination: {
                page,
                limit,
                total: users.length
            }
        });
    });
    // Get user by ID
    getUser = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const { id } = req.params;
        const user = await _usermodel.default.findById(id);
        if (!user) {
            throw new _AppError.AppError('User not found', 404);
        }
        res.json({
            success: true,
            data: user
        });
    });
    // Update user profile
    updateUser = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const { id } = req.params;
        const updates = req.body;
        // Check if user is updating their own profile or is admin
        if (req.user.id !== id && req.user.role !== 'ADMIN') {
            throw new _AppError.AppError('You can only update your own profile', 403);
        }
        // Prevent updating certain fields
        delete updates.id;
        delete updates.email; // Email change should be done through separate verification process
        delete updates.password; // Password change should be done through separate endpoint
        delete updates.role; // Role can only be changed by admin
        const updatedUser = await _usermodel.default.update(id, updates);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    });
    // Delete user (admin only or self)
    deleteUser = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const { id } = req.params;
        // Check if user is deleting their own account or is admin
        if (req.user.id !== id && req.user.role !== 'ADMIN') {
            throw new _AppError.AppError('You can only delete your own account', 403);
        }
        await _usermodel.default.delete(id);
        res.status(204).json({
            success: true,
            message: 'User deleted successfully'
        });
    });
    // Change password
    changePassword = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            throw new _AppError.AppError('Current password and new password are required', 400);
        }
        const user = await _usermodel.default.findByEmail(req.user.email);
        if (!user || !user.password) {
            throw new _AppError.AppError('User not found', 404);
        }
        // Verify current password
        const isPasswordValid = await _usermodel.default.verifyPassword(currentPassword, user.password);
        if (!isPasswordValid) {
            throw new _AppError.AppError('Current password is incorrect', 401);
        }
        // Update password
        await _usermodel.default.update(userId, {
            password: newPassword
        });
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    });
    // Get user stats (for dashboard)
    getUserStats = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const userId = req.user.id;
        const userRole = req.user.role;
        // This would be more complex with actual database queries
        const stats = {
            userId,
            role: userRole,
            ...userRole === 'DOG_OWNER' && {
                totalBookings: 0,
                upcomingBookings: 0,
                savedFields: 0,
                totalSpent: 0
            },
            ...userRole === 'FIELD_OWNER' && {
                totalFields: 0,
                activeFields: 0,
                totalBookings: 0,
                totalRevenue: 0,
                averageRating: 0
            }
        };
        res.json({
            success: true,
            data: stats
        });
    });
}
const _default = new UserController();

//# sourceMappingURL=user.controller.js.map