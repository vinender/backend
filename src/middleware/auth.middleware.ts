import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import UserModel from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Middleware to protect routes - requires valid JWT token
 */
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Check for token in cookies
  else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    throw new AppError('You are not logged in. Please log in to access this resource', 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Check if user still exists
    const user = await UserModel.findById(decoded.id);
    if (!user) {
      throw new AppError('The user belonging to this token no longer exists', 401);
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    throw new AppError('Invalid token. Please log in again', 401);
  }
});

/**
 * Middleware to restrict access to specific roles
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('You must be logged in to access this resource', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action', 403);
    }

    next();
  };
};

/**
 * Optional auth middleware - attaches user if token exists but doesn't require it
 */
export const optionalAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Check for token in cookies
  else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Check if user still exists
      const user = await UserModel.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Invalid token, but continue without user
    }
  }

  next();
});