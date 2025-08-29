"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginWithOtpCheck = exports.resetPasswordWithOtp = exports.verifyPasswordResetOtp = exports.requestPasswordReset = exports.resendOtp = exports.verifySignupOtp = exports.registerWithOtp = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const asyncHandler_1 = require("../utils/asyncHandler");
const AppError_1 = require("../utils/AppError");
const otp_service_1 = require("../services/otp.service");
const constants_1 = require("../config/constants");
const prisma = new client_1.PrismaClient();
// Generate JWT token
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ id: userId }, constants_1.JWT_SECRET, {
        expiresIn: constants_1.JWT_EXPIRES_IN,
    });
};
// Register new user with OTP
exports.registerWithOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, password, role = 'DOG_OWNER', phone } = req.body;
    // Validate input
    if (!name || !email || !password) {
        throw new AppError_1.AppError('Missing required fields', 400);
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new AppError_1.AppError('Invalid email format', 400);
    }
    // Validate password strength
    if (password.length < 8) {
        throw new AppError_1.AppError('Password must be at least 8 characters long', 400);
    }
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
        where: {
            email,
            role,
        },
    });
    if (existingUser) {
        if (existingUser.emailVerified) {
            throw new AppError_1.AppError('User already exists with this email', 409);
        }
        // If user exists but not verified, allow them to re-register (update their data)
    }
    // Hash password
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    // Create or update user (but not verified yet)
    const user = await prisma.user.upsert({
        where: {
            email_role: {
                email,
                role,
            },
        },
        update: {
            name,
            password: hashedPassword,
            phone,
            emailVerified: null, // Reset verification
        },
        create: {
            name,
            email,
            password: hashedPassword,
            role,
            phone,
            emailVerified: null,
        },
    });
    // Send OTP
    try {
        await otp_service_1.otpService.sendOtp(email, 'SIGNUP', name);
    }
    catch (error) {
        // Delete user if OTP sending fails (only if newly created)
        if (!existingUser) {
            await prisma.user.delete({
                where: { id: user.id },
            });
        }
        throw new AppError_1.AppError('Failed to send verification email. Please try again.', 500);
    }
    res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email for the verification code.',
        data: {
            email,
            role,
        },
    });
});
// Verify OTP and complete registration
exports.verifySignupOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, otp, role = 'DOG_OWNER' } = req.body;
    if (!email || !otp) {
        throw new AppError_1.AppError('Email and OTP are required', 400);
    }
    // Verify OTP
    const isValid = await otp_service_1.otpService.verifyOtp(email, otp, 'SIGNUP');
    if (!isValid) {
        throw new AppError_1.AppError('Invalid or expired OTP', 400);
    }
    // Update user as verified
    const user = await prisma.user.update({
        where: {
            email_role: {
                email,
                role,
            },
        },
        data: {
            emailVerified: new Date(),
        },
    });
    // Generate token
    const token = generateToken(user.id);
    res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
            },
            token,
        },
    });
});
// Resend OTP
exports.resendOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, type = 'SIGNUP' } = req.body;
    if (!email) {
        throw new AppError_1.AppError('Email is required', 400);
    }
    // Get user name for email
    const user = await prisma.user.findFirst({
        where: { email },
    });
    try {
        await otp_service_1.otpService.resendOtp(email, type, user?.name || undefined);
    }
    catch (error) {
        throw new AppError_1.AppError(error.message || 'Failed to resend OTP', 400);
    }
    res.json({
        success: true,
        message: 'OTP sent successfully',
    });
});
// Request password reset OTP
exports.requestPasswordReset = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new AppError_1.AppError('Email is required', 400);
    }
    // Check if user exists
    const user = await prisma.user.findFirst({
        where: { email },
    });
    if (!user) {
        // Don't reveal if user exists or not
        res.json({
            success: true,
            message: 'If an account exists with this email, you will receive a password reset code.',
        });
        return;
    }
    // Send OTP
    try {
        await otp_service_1.otpService.sendOtp(email, 'RESET_PASSWORD', user.name || undefined);
    }
    catch (error) {
        throw new AppError_1.AppError('Failed to send reset email. Please try again.', 500);
    }
    res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset code.',
    });
});
// Verify password reset OTP (without marking as used)
exports.verifyPasswordResetOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        throw new AppError_1.AppError('Email and OTP are required', 400);
    }
    // Check OTP validity without marking as verified
    const isValid = await otp_service_1.otpService.checkOtpValidity(email, otp, 'RESET_PASSWORD');
    if (!isValid) {
        throw new AppError_1.AppError('Invalid or expired OTP', 400);
    }
    res.json({
        success: true,
        message: 'OTP verified successfully. You can now reset your password.',
        data: {
            email,
            otpVerified: true,
        },
    });
});
// Reset password after OTP verification
exports.resetPasswordWithOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
        throw new AppError_1.AppError('Email, OTP, and new password are required', 400);
    }
    // Validate password strength
    if (newPassword.length < 8) {
        throw new AppError_1.AppError('Password must be at least 8 characters long', 400);
    }
    // Verify OTP again for security
    const isValid = await otp_service_1.otpService.verifyOtp(email, otp, 'RESET_PASSWORD');
    if (!isValid) {
        throw new AppError_1.AppError('Invalid or expired OTP', 400);
    }
    // Hash new password
    const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
    // Update user password
    await prisma.user.updateMany({
        where: { email },
        data: {
            password: hashedPassword,
        },
    });
    res.json({
        success: true,
        message: 'Password reset successfully',
    });
});
// Login with email verification check
exports.loginWithOtpCheck = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password, role = 'DOG_OWNER' } = req.body;
    if (!email || !password) {
        throw new AppError_1.AppError('Email and password are required', 400);
    }
    // Find user
    const user = await prisma.user.findFirst({
        where: {
            email,
            role,
        },
    });
    if (!user) {
        throw new AppError_1.AppError('Invalid credentials', 401);
    }
    // Check if email is verified
    if (!user.emailVerified) {
        // Send new OTP
        await otp_service_1.otpService.sendOtp(email, 'EMAIL_VERIFICATION', user.name || undefined);
        res.status(403).json({
            success: false,
            message: 'Email not verified. We have sent you a verification code.',
            data: {
                requiresVerification: true,
                email,
                role,
            },
        });
        return;
    }
    // Verify password
    const isPasswordValid = await bcryptjs_1.default.compare(password, user.password || '');
    if (!isPasswordValid) {
        throw new AppError_1.AppError('Invalid credentials', 401);
    }
    // Generate token
    const token = generateToken(user.id);
    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                image: user.image,
            },
            token,
        },
    });
});
