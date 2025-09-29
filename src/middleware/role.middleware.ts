//@ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return next(new AppError('User not authenticated', 401));
    }

    if (!roles.includes(user.role)) {
      return next(new AppError(`Access denied. Required role: ${roles.join(' or ')}`, 403));
    }

    next();
  };
};
