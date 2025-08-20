import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/constants';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

class AuthController {
  // Register new user
  register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    console.log('Registration request body:', req.body);
    const { name, email, password, role, phone } = req.body;

    // Validate input
    if (!name || !email || !password) {
      throw new AppError('Missing required fields', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Invalid email format', 400);
    }

    // Validate password strength
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }

    // Check if user already exists with same email AND role
    const userRole = role || 'DOG_OWNER';
    const existingUser = await UserModel.findByEmailAndRole(email, userRole);
    if (existingUser) {
      // Check if user has OAuth accounts
      const hasOAuthAccount = await UserModel.hasOAuthAccount(existingUser.id);
      const hasPassword = !!existingUser.password;
      
      if (hasOAuthAccount && !hasPassword) {
        // User exists with OAuth only
        throw new AppError('This account is already registered with Google/Apple. Please sign in using the social login option.', 409);
      } else if (hasPassword) {
        // User exists with email/password
        throw new AppError(`An account with this email already exists as ${userRole.replace('_', ' ')}. Please sign in instead.`, 409);
      } else {
        // Generic message
        throw new AppError(`User already exists with this email and role`, 409);
      }
    }

    // Check if phone number already exists
    if (phone) {
      const existingUserByPhone = await UserModel.findByPhone(phone);
      if (existingUserByPhone) {
        throw new AppError('This phone number is already registered with another account. Please use a different phone number or sign in to your existing account.', 409);
      }
    }

    // Validate role
    const validRoles = ['DOG_OWNER', 'FIELD_OWNER', 'ADMIN'];
    if (role && !validRoles.includes(role)) {
      throw new AppError('Invalid role specified', 400);
    }

    // Create user
    const user = await UserModel.create({
      name,
      email,
      password,
      role: userRole,
      phone,
    });

    // NOTE: Empty field creation removed - fields are now created dynamically
    // when the field owner first saves their field details.
    // This prevents orphaned field documents and handles cases where
    // fields are deleted from the database.
    
    // Old code kept for reference:
    // if (user.role === 'FIELD_OWNER') {
    //   try {
    //     const FieldModel = require('../models/field.model').default;
    //     await FieldModel.create({
    //       ownerId: user.id,
    //       fieldDetailsCompleted: false,
    //       uploadImagesCompleted: false,
    //       pricingAvailabilityCompleted: false,
    //       bookingRulesCompleted: false,
    //       isActive: false,
    //       amenities: [],
    //       rules: [],
    //       images: [],
    //       operatingDays: []
    //     });
    //   } catch (error) {
    //     console.error('Error creating empty field for field owner:', error);
    //   }
    // }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { 
        expiresIn: JWT_EXPIRES_IN as string | number
      }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user,
        token,
      },
    });
  });

  // Login user
  login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password, role } = req.body;

    // Validate input
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Find user by email and role if role is provided
    let user;
    if (role) {
      user = await UserModel.findByEmailAndRole(email, role);
      if (!user) {
        throw new AppError(`No ${role.replace('_', ' ')} account found with this email`, 401);
      }
    } else {
      // If no role specified, find any user with this email
      // This maintains backward compatibility
      user = await UserModel.findByEmail(email);
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }
    }
    
    // Check if user has password (they might only have OAuth)
    if (!user.password) {
      const hasOAuthAccount = await UserModel.hasOAuthAccount(user.id);
      if (hasOAuthAccount) {
        const providers = await UserModel.getOAuthProviders(user.id);
        const providerList = providers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' or ');
        throw new AppError(`This account uses ${providerList} sign-in. Please use the social login button to sign in.`, 401);
      } else {
        throw new AppError('Invalid email or password', 401);
      }
    }

    // Verify password
    const isPasswordValid = await UserModel.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { 
        expiresIn: JWT_EXPIRES_IN as string | number
      }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  });

  // Get current user
  getMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: user,
    });
  });

  // Logout (if using sessions/cookies)
  logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // If using cookies, clear them here
    res.clearCookie('token');
    
    res.json({
      success: true,
      message: 'Logout successful',
    });
  });

  // Refresh token
  refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      
      // Generate new access token
      const newToken = jwt.sign(
        { 
          id: decoded.id, 
          email: decoded.email, 
          role: decoded.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        data: {
          token: newToken,
        },
      });
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  });

  // Social login (Google/Apple)
  socialLogin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, name, image, provider, providerId, role } = req.body;

    // Validate input
    if (!email || !provider || !providerId) {
      throw new AppError('Missing required fields', 400);
    }

    // Validate provider
    const validProviders = ['google', 'apple'];
    if (!validProviders.includes(provider)) {
      throw new AppError('Invalid provider', 400);
    }

    // Validate role if provided
    const validRoles = ['DOG_OWNER', 'FIELD_OWNER'];
    if (role && !validRoles.includes(role)) {
      throw new AppError('Invalid role specified', 400);
    }

    // Create or update user
    const user = await UserModel.createOrUpdateSocialUser({
      email,
      name,
      image,
      provider,
      providerId,
      role: role || 'DOG_OWNER',
    });

    // NOTE: Empty field creation removed - fields are now created dynamically
    // when the field owner first saves their field details.
    // See comment in register method for more details.

    // Store OAuth account info
    const account = await UserModel.hasOAuthAccount(user.id);
    if (!account) {
      // Create account record for tracking OAuth provider
      // This would typically be done in a separate Account model
      // For now, we're just tracking the provider in the User model
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        provider: user.provider
      },
      JWT_SECRET,
      { 
        expiresIn: JWT_EXPIRES_IN as string | number
      }
    );

    res.json({
      success: true,
      message: 'Social login successful',
      data: {
        user,
        token,
      },
    });
  });

  // Update user role (for OAuth users who selected role after account creation)
  updateRole = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, role } = req.body;
    const userId = (req as any).user?.id;

    // Validate input
    if (!email || !role) {
      throw new AppError('Email and role are required', 400);
    }

    // Validate role
    const validRoles = ['DOG_OWNER', 'FIELD_OWNER'];
    if (!validRoles.includes(role)) {
      throw new AppError('Invalid role specified', 400);
    }

    // Verify the user is updating their own role
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.id !== userId) {
      throw new AppError('You can only update your own role', 403);
    }

    // Update the user's role
    const updatedUser = await UserModel.updateRole(user.id, role);

    // NOTE: Empty field creation removed - fields are now created dynamically
    // when the field owner first saves their field details.
    // See comment in register method for more details.

    // Generate new token with updated role
    const token = jwt.sign(
      { 
        id: updatedUser.id, 
        email: updatedUser.email, 
        role: updatedUser.role 
      },
      JWT_SECRET,
      { 
        expiresIn: JWT_EXPIRES_IN as string | number
      }
    );

    res.json({
      success: true,
      message: 'Role updated successfully',
      data: {
        user: updatedUser,
        token,
      },
    });
  });
}

export default new AuthController();