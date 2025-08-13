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

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      // Check if user has OAuth accounts
      const hasOAuthAccount = await UserModel.hasOAuthAccount(existingUser.id);
      const hasPassword = !!existingUser.password;
      
      if (hasOAuthAccount && !hasPassword) {
        // User exists with OAuth only
        throw new AppError('This email is already registered with Google/Apple. Please sign in using the social login option.', 409);
      } else if (hasPassword) {
        // User exists with email/password
        throw new AppError('An account with this email already exists. Please sign in instead.', 409);
      } else {
        // Generic message
        throw new AppError('User already exists with this email', 409);
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
      role: role || 'DOG_OWNER',
      phone,
    });

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
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
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
}

export default new AuthController();