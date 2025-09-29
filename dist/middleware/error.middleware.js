"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.errorHandler = void 0;
const AppError_1 = require("../utils/AppError");
/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
        console.error('ERROR 💥', err);
    }
    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Invalid ID format';
        error = new AppError_1.AppError(message, 400);
    }
    // Mongoose duplicate key
    if (err.code === 11000) {
        const value = err.errmsg.match(/(["'])(\?.)*?\1/)[0];
        const message = `Duplicate field value: ${value}. Please use another value!`;
        error = new AppError_1.AppError(message, 400);
    }
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((el) => el.message);
        const message = `Invalid input data. ${errors.join('. ')}`;
        error = new AppError_1.AppError(message, 400);
    }
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AppError_1.AppError('Invalid token. Please log in again!', 401);
    }
    if (err.name === 'TokenExpiredError') {
        error = new AppError_1.AppError('Your token has expired! Please log in again.', 401);
    }
    // Send error response
    const statusCode = error.statusCode || 500;
    const status = error.status || 'error';
    res.status(statusCode).json({
        success: false,
        status,
        message: error.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && {
            error: err,
            stack: err.stack,
        }),
    });
};
exports.errorHandler = errorHandler;
/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
    const error = new AppError_1.AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
};
exports.notFound = notFound;
