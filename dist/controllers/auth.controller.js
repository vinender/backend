"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const constants_1 = require("../config/constants");
const asyncHandler_1 = require("../utils/asyncHandler");
const AppError_1 = require("../utils/AppError");
class AuthController {
    // Register new user
    register = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        console.log('Registration request body:', req.body);
        const { name, email, password, role, phone } = req.body;
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
        // Check if user already exists with same email (regardless of role)
        const userRole = role || 'DOG_OWNER';
        const existingUser = await user_model_1.default.findByEmail(email);
        if (existingUser) {
            // Check if the existing user has a different role
            if (existingUser.role !== userRole) {
                throw new AppError_1.AppError(`An account already exists with this email.`, 409);
            }
            // Check if user has OAuth accounts
            const hasOAuthAccount = await user_model_1.default.hasOAuthAccount(existingUser.id);
            const hasPassword = !!existingUser.password;
            if (hasOAuthAccount && !hasPassword) {
                // User exists with OAuth only
                throw new AppError_1.AppError('This account is already registered with Google/Apple. Please sign in using the social login option.', 409);
            }
            else if (hasPassword) {
                // User exists with email/password
                throw new AppError_1.AppError(`An account with this email already exists. Please sign in instead.`, 409);
            }
            else {
                // Generic message
                throw new AppError_1.AppError(`User already exists with this email`, 409);
            }
        }
        // Check if phone number already exists
        if (phone) {
            const existingUserByPhone = await user_model_1.default.findByPhone(phone);
            if (existingUserByPhone) {
                throw new AppError_1.AppError('This phone number is already registered with another account. Please use a different phone number or sign in to your existing account.', 409);
            }
        }
        // Validate role
        const validRoles = ['DOG_OWNER', 'FIELD_OWNER', 'ADMIN'];
        if (role && !validRoles.includes(role)) {
            throw new AppError_1.AppError('Invalid role specified', 400);
        }
        // Create user
        const user = await user_model_1.default.create({
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
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role
        }, constants_1.JWT_SECRET, {
            expiresIn: constants_1.JWT_EXPIRES_IN
        });
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
    login = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { email, password, role } = req.body;
        // Validate input
        if (!email || !password) {
            throw new AppError_1.AppError('Email and password are required', 400);
        }
        // Find user by email only (since email is unique across all roles now)
        const user = await user_model_1.default.findByEmail(email);
        if (!user) {
            throw new AppError_1.AppError('Invalid email or password', 401);
        }
        // If role is specified, verify it matches the user's role
        if (role && user.role !== role) {
            throw new AppError_1.AppError(`This account is registered as a ${user.role.replace('_', ' ').toLowerCase()}. Please use the correct login form.`, 401);
        }
        // Check if user has password (they might only have OAuth)
        if (!user.password) {
            const hasOAuthAccount = await user_model_1.default.hasOAuthAccount(user.id);
            if (hasOAuthAccount) {
                const providers = await user_model_1.default.getOAuthProviders(user.id);
                const providerList = providers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' or ');
                throw new AppError_1.AppError(`This account uses ${providerList} sign-in. Please use the social login button to sign in.`, 401);
            }
            else {
                throw new AppError_1.AppError('Invalid email or password', 401);
            }
        }
        // Verify password
        const isPasswordValid = await user_model_1.default.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            throw new AppError_1.AppError('Invalid email or password', 401);
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role
        }, constants_1.JWT_SECRET, {
            expiresIn: constants_1.JWT_EXPIRES_IN
        });
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
    getMe = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user?.id;
        if (!userId) {
            throw new AppError_1.AppError('User not authenticated', 401);
        }
        const user = await user_model_1.default.findById(userId);
        if (!user) {
            throw new AppError_1.AppError('User not found', 404);
        }
        res.json({
            success: true,
            data: user,
        });
    });
    // Logout (if using sessions/cookies)
    logout = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        // If using cookies, clear them here
        res.clearCookie('token');
        res.json({
            success: true,
            message: 'Logout successful',
        });
    });
    // Refresh token
    refreshToken = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new AppError_1.AppError('Refresh token is required', 400);
        }
        try {
            // Verify refresh token
            const decoded = jsonwebtoken_1.default.verify(refreshToken, constants_1.JWT_SECRET);
            // Generate new access token
            const newToken = jsonwebtoken_1.default.sign({
                id: decoded.id,
                email: decoded.email,
                role: decoded.role
            }, constants_1.JWT_SECRET, { expiresIn: constants_1.JWT_EXPIRES_IN });
            res.json({
                success: true,
                data: {
                    token: newToken,
                },
            });
        }
        catch (error) {
            throw new AppError_1.AppError('Invalid refresh token', 401);
        }
    });
    // Social login (Google/Apple)
    socialLogin = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { email, name, image, provider, providerId, role } = req.body;
        // Comprehensive logging for social login payload
        console.log('==================== SOCIAL LOGIN PAYLOAD ====================');
        console.log('Full Request Body:', JSON.stringify(req.body, null, 2));
        console.log('Individual Fields:');
        console.log('  - Email:', email);
        console.log('  - Name:', name);
        console.log('  - Image:', image);
        console.log('  - Provider:', provider);
        console.log('  - Provider ID:', providerId);
        console.log('  - Role:', role);
        console.log('==============================================================');
        // Validate input
        if (!email || !provider || !providerId) {
            console.log('❌ VALIDATION FAILED: Missing required fields');
            console.log('  - Email present:', !!email);
            console.log('  - Provider present:', !!provider);
            console.log('  - Provider ID present:', !!providerId);
            throw new AppError_1.AppError('Missing required fields', 400);
        }
        // Validate provider
        const validProviders = ['google', 'apple'];
        if (!validProviders.includes(provider)) {
            console.log('❌ VALIDATION FAILED: Invalid provider -', provider);
            throw new AppError_1.AppError('Invalid provider', 400);
        }
        console.log('✅ Provider validation passed:', provider);
        // Validate role if provided
        const validRoles = ['DOG_OWNER', 'FIELD_OWNER'];
        if (role && !validRoles.includes(role)) {
            console.log('❌ VALIDATION FAILED: Invalid role -', role);
            throw new AppError_1.AppError('Invalid role specified', 400);
        }
        console.log('✅ Role validation passed:', role || 'DOG_OWNER (default)');
        // Check if user already exists AND is verified
        console.log('🔍 Checking for existing user with email:', email);
        const existingUser = await user_model_1.default.findByEmail(email);
        if (existingUser && existingUser.emailVerified) {
            console.log('✅ Existing verified user found - logging in immediately');
            console.log('  - User ID:', existingUser.id);
            console.log('  - User Role:', existingUser.role);
            console.log('  - Provider:', existingUser.provider);
            // User exists and is verified - log them in immediately
            const token = jsonwebtoken_1.default.sign({
                id: existingUser.id,
                email: existingUser.email,
                role: existingUser.role,
                provider: existingUser.provider
            }, constants_1.JWT_SECRET, {
                expiresIn: constants_1.JWT_EXPIRES_IN
            });
            console.log('✅ Token generated for existing user');
            return res.json({
                success: true,
                message: 'Social login successful',
                data: {
                    user: existingUser,
                    token,
                },
            });
        }
        // Create or update user (NOT VERIFIED YET)
        console.log('📝 Creating or updating social user...');
        console.log('  - Email:', email);
        console.log('  - Name:', name);
        console.log('  - Image:', image);
        console.log('  - Provider:', provider);
        console.log('  - Provider ID:', providerId);
        console.log('  - Role:', role || 'DOG_OWNER');
        const user = await user_model_1.default.createOrUpdateSocialUser({
            email,
            name,
            image,
            provider,
            providerId,
            role: role || 'DOG_OWNER',
        });
        console.log('✅ User created/updated successfully');
        console.log('  - User ID:', user.id);
        console.log('  - Email Verified:', user.emailVerified);
        // NOTE: Empty field creation removed - fields are now created dynamically
        // when the field owner first saves their field details.
        // See comment in register method for more details.
        // Send OTP for verification
        console.log('📧 Sending OTP for email verification...');
        const { otpService } = require('../services/otp.service');
        await otpService.sendOtp(email, 'SOCIAL_LOGIN', name);
        console.log('✅ OTP sent successfully to:', email);
        console.log('📤 Sending response - OTP verification required');
        res.status(200).json({
            success: true,
            requiresVerification: true,
            message: 'Please check your email for verification code',
            data: {
                email,
                role: user.role,
            },
        });
        console.log('==================== SOCIAL LOGIN COMPLETE ====================');
    });
    // Update user role (for OAuth users who selected role after account creation)
    updateRole = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { email, role } = req.body;
        const userId = req.user?.id;
        // Validate input
        if (!email || !role) {
            throw new AppError_1.AppError('Email and role are required', 400);
        }
        // Validate role
        const validRoles = ['DOG_OWNER', 'FIELD_OWNER'];
        if (!validRoles.includes(role)) {
            throw new AppError_1.AppError('Invalid role specified', 400);
        }
        // Verify the user is updating their own role
        const user = await user_model_1.default.findByEmail(email);
        if (!user) {
            throw new AppError_1.AppError('User not found', 404);
        }
        if (user.id !== userId) {
            throw new AppError_1.AppError('You can only update your own role', 403);
        }
        // Update the user's role
        const updatedUser = await user_model_1.default.updateRole(user.id, role);
        // NOTE: Empty field creation removed - fields are now created dynamically
        // when the field owner first saves their field details.
        // See comment in register method for more details.
        // Generate new token with updated role
        const token = jsonwebtoken_1.default.sign({
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role
        }, constants_1.JWT_SECRET, {
            expiresIn: constants_1.JWT_EXPIRES_IN
        });
        res.json({
            success: true,
            message: 'Role updated successfully',
            data: {
                user: updatedUser,
                token,
            },
        });
    });
    // Apple Sign In - Mobile & Web friendly
    // Handles Apple ID token verification on backend
    appleSignIn = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { idToken, name, role } = req.body;
        console.log('==================== APPLE SIGN IN ====================');
        console.log('Request Body:', { hasIdToken: !!idToken, name, role });
        // Validate input
        if (!idToken) {
            console.log('❌ VALIDATION FAILED: Missing ID token');
            throw new AppError_1.AppError('Apple ID token is required', 400);
        }
        // Validate role if provided
        const validRoles = ['DOG_OWNER', 'FIELD_OWNER'];
        if (role && !validRoles.includes(role)) {
            console.log('❌ VALIDATION FAILED: Invalid role -', role);
            throw new AppError_1.AppError('Invalid role specified', 400);
        }
        console.log('✅ Role validation passed:', role || 'DOG_OWNER (default)');
        try {
            // Verify Apple ID token using backend service
            console.log('🔐 Verifying Apple ID token...');
            const { appleSignInService } = require('../services/apple-signin.service');
            const appleUser = await appleSignInService.verifyIdToken(idToken);
            console.log('✅ Apple token verified successfully');
            console.log('  - Apple User ID:', appleUser.sub);
            console.log('  - Email:', appleUser.email);
            console.log('  - Email Verified:', appleUser.emailVerified);
            // Check if user already exists AND is verified
            console.log('🔍 Checking for existing user with email:', appleUser.email);
            const existingUser = await user_model_1.default.findByEmail(appleUser.email);
            if (existingUser && existingUser.emailVerified) {
                console.log('✅ Existing verified user found - logging in immediately');
                console.log('  - User ID:', existingUser.id);
                console.log('  - User Role:', existingUser.role);
                // User exists and is verified - log them in immediately
                const token = jsonwebtoken_1.default.sign({
                    id: existingUser.id,
                    email: existingUser.email,
                    role: existingUser.role,
                    provider: 'apple'
                }, constants_1.JWT_SECRET, {
                    expiresIn: constants_1.JWT_EXPIRES_IN
                });
                console.log('✅ Token generated for existing user');
                return res.json({
                    success: true,
                    message: 'Apple sign in successful',
                    data: {
                        user: existingUser,
                        token,
                    },
                });
            }
            // Create or update user (NOT VERIFIED YET)
            console.log('📝 Creating or updating Apple user...');
            console.log('  - Email:', appleUser.email);
            console.log('  - Name:', name || appleUser.name);
            console.log('  - Provider ID:', appleUser.sub);
            console.log('  - Role:', role || 'DOG_OWNER');
            const user = await user_model_1.default.createOrUpdateSocialUser({
                email: appleUser.email,
                name: name || (appleUser.name ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim() : undefined),
                image: undefined, // Apple doesn't provide profile images
                provider: 'apple',
                providerId: appleUser.sub,
                role: role || 'DOG_OWNER',
            });
            console.log('✅ User created/updated successfully');
            console.log('  - User ID:', user.id);
            console.log('  - Email Verified:', user.emailVerified);
            // Send OTP for verification
            console.log('📧 Sending OTP for email verification...');
            const { otpService } = require('../services/otp.service');
            await otpService.sendOtp(appleUser.email, 'SOCIAL_LOGIN', name || user.name);
            console.log('✅ OTP sent successfully to:', appleUser.email);
            console.log('📤 Sending response - OTP verification required');
            res.status(200).json({
                success: true,
                requiresVerification: true,
                message: 'Please check your email for verification code',
                data: {
                    email: appleUser.email,
                    role: user.role,
                },
            });
            console.log('==================== APPLE SIGN IN COMPLETE ====================');
        }
        catch (error) {
            console.error('❌ Apple Sign In failed:', error);
            // Handle specific Apple Sign In errors
            if (error.message && error.message.includes('Invalid Apple ID token')) {
                throw new AppError_1.AppError('Invalid or expired Apple ID token', 401);
            }
            // Re-throw other errors
            throw error;
        }
    });
}
exports.default = new AuthController();
