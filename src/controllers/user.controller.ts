//@ts-nocheck
import { Request, Response, NextFunction } from 'express';
import UserModel from '../models/user.model';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../config/constants';

class UserController {
  // Get all users (admin only)
  getAllUsers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const users = await UserModel.findAll(skip, limit);

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
  getUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const user = await UserModel.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: user,
    });
  });

  // Update user profile
  updateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const updates = req.body;

    // Check if user is updating their own profile or is admin
    if ((req as any).user.id !== id && (req as any).user.role !== 'ADMIN') {
      throw new AppError('You can only update your own profile', 403);
    }

    // Prevent updating certain fields
    delete updates.id;
    delete updates.email; // Email change should be done through separate verification process
    delete updates.password; // Password change should be done through separate endpoint
    delete updates.role; // Role can only be changed by admin

    const updatedUser = await UserModel.update(id, updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  });

  // Delete user (admin only or self)
  deleteUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Check if user is deleting their own account or is admin
    if ((req as any).user.id !== id && (req as any).user.role !== 'ADMIN') {
      throw new AppError('You can only delete your own account', 403);
    }

    await UserModel.delete(id);

    res.status(204).json({
      success: true,
      message: 'User deleted successfully',
    });
  });

  // Change password
  changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    const user = await UserModel.findByEmail((req as any).user.email);
    if (!user || !user.password) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isPasswordValid = await UserModel.verifyPassword(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash the new password before updating
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password with hashed version
    await UserModel.update(userId, { password: hashedPassword } as any);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  });

  // Get user stats (for dashboard)
  getUserStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

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

export default new UserController();
