import { Request, Response, NextFunction } from 'express';

/**
 * Async handler wrapper to avoid try-catch blocks in controllers
 * Catches errors in async functions and passes them to Express error handler
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};