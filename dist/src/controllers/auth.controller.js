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
const _jsonwebtoken = /*#__PURE__*/ _interop_require_default(require("jsonwebtoken"));
const _usermodel = /*#__PURE__*/ _interop_require_default(require("../models/user.model"));
const _constants = require("../config/constants");
const _asyncHandler = require("../utils/asyncHandler");
const _AppError = require("../utils/AppError");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class AuthController {
    // Register new user
    register = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        console.log('Registration request body:', req.body);
        const { name, email, password, role, phone } = req.body;
        // Validate input
        if (!name || !email || !password) {
            throw new _AppError.AppError('Missing required fields', 400);
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new _AppError.AppError('Invalid email format', 400);
        }
        // Validate password strength
        if (password.length < 8) {
            throw new _AppError.AppError('Password must be at least 8 characters long', 400);
        }
        // Check if user already exists with same email AND role
        const userRole = role || 'DOG_OWNER';
        const existingUser = await _usermodel.default.findByEmailAndRole(email, userRole);
        if (existingUser) {
            // Check if user has OAuth accounts
            const hasOAuthAccount = await _usermodel.default.hasOAuthAccount(existingUser.id);
            const hasPassword = !!existingUser.password;
            if (hasOAuthAccount && !hasPassword) {
                // User exists with OAuth only
                throw new _AppError.AppError('This account is already registered with Google/Apple. Please sign in using the social login option.', 409);
            } else if (hasPassword) {
                // User exists with email/password
                throw new _AppError.AppError(`An account with this email already exists as ${userRole.replace('_', ' ')}. Please sign in instead.`, 409);
            } else {
                // Generic message
                throw new _AppError.AppError(`User already exists with this email and role`, 409);
            }
        }
        // Check if phone number already exists
        if (phone) {
            const existingUserByPhone = await _usermodel.default.findByPhone(phone);
            if (existingUserByPhone) {
                throw new _AppError.AppError('This phone number is already registered with another account. Please use a different phone number or sign in to your existing account.', 409);
            }
        }
        // Validate role
        const validRoles = [
            'DOG_OWNER',
            'FIELD_OWNER',
            'ADMIN'
        ];
        if (role && !validRoles.includes(role)) {
            throw new _AppError.AppError('Invalid role specified', 400);
        }
        // Create user
        const user = await _usermodel.default.create({
            name,
            email,
            password,
            role: userRole,
            phone
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
        const token = _jsonwebtoken.default.sign({
            id: user.id,
            email: user.email,
            role: user.role
        }, _constants.JWT_SECRET, {
            expiresIn: _constants.JWT_EXPIRES_IN
        });
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user,
                token
            }
        });
    });
    // Login user
    login = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const { email, password, role } = req.body;
        // Validate input
        if (!email || !password) {
            throw new _AppError.AppError('Email and password are required', 400);
        }
        // Find user by email and role if role is provided
        let user;
        if (role) {
            user = await _usermodel.default.findByEmailAndRole(email, role);
            if (!user) {
                throw new _AppError.AppError(`No ${role.replace('_', ' ')} account found with this email`, 401);
            }
        } else {
            // If no role specified, find any user with this email
            // This maintains backward compatibility
            user = await _usermodel.default.findByEmail(email);
            if (!user) {
                throw new _AppError.AppError('Invalid email or password', 401);
            }
        }
        // Check if user has password (they might only have OAuth)
        if (!user.password) {
            const hasOAuthAccount = await _usermodel.default.hasOAuthAccount(user.id);
            if (hasOAuthAccount) {
                const providers = await _usermodel.default.getOAuthProviders(user.id);
                const providerList = providers.map((p)=>p.charAt(0).toUpperCase() + p.slice(1)).join(' or ');
                throw new _AppError.AppError(`This account uses ${providerList} sign-in. Please use the social login button to sign in.`, 401);
            } else {
                throw new _AppError.AppError('Invalid email or password', 401);
            }
        }
        // Verify password
        const isPasswordValid = await _usermodel.default.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            throw new _AppError.AppError('Invalid email or password', 401);
        }
        // Generate JWT token
        const token = _jsonwebtoken.default.sign({
            id: user.id,
            email: user.email,
            role: user.role
        }, _constants.JWT_SECRET, {
            expiresIn: _constants.JWT_EXPIRES_IN
        });
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: userWithoutPassword,
                token
            }
        });
    });
    // Get current user
    getMe = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const userId = req.user?.id;
        if (!userId) {
            throw new _AppError.AppError('User not authenticated', 401);
        }
        const user = await _usermodel.default.findById(userId);
        if (!user) {
            throw new _AppError.AppError('User not found', 404);
        }
        res.json({
            success: true,
            data: user
        });
    });
    // Logout (if using sessions/cookies)
    logout = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        // If using cookies, clear them here
        res.clearCookie('token');
        res.json({
            success: true,
            message: 'Logout successful'
        });
    });
    // Refresh token
    refreshToken = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new _AppError.AppError('Refresh token is required', 400);
        }
        try {
            // Verify refresh token
            const decoded = _jsonwebtoken.default.verify(refreshToken, _constants.JWT_SECRET);
            // Generate new access token
            const newToken = _jsonwebtoken.default.sign({
                id: decoded.id,
                email: decoded.email,
                role: decoded.role
            }, _constants.JWT_SECRET, {
                expiresIn: _constants.JWT_EXPIRES_IN
            });
            res.json({
                success: true,
                data: {
                    token: newToken
                }
            });
        } catch (error) {
            throw new _AppError.AppError('Invalid refresh token', 401);
        }
    });
    // Social login (Google/Apple)
    socialLogin = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const { email, name, image, provider, providerId, role } = req.body;
        // Validate input
        if (!email || !provider || !providerId) {
            throw new _AppError.AppError('Missing required fields', 400);
        }
        // Validate provider
        const validProviders = [
            'google',
            'apple'
        ];
        if (!validProviders.includes(provider)) {
            throw new _AppError.AppError('Invalid provider', 400);
        }
        // Validate role if provided
        const validRoles = [
            'DOG_OWNER',
            'FIELD_OWNER'
        ];
        if (role && !validRoles.includes(role)) {
            throw new _AppError.AppError('Invalid role specified', 400);
        }
        // Create or update user
        const user = await _usermodel.default.createOrUpdateSocialUser({
            email,
            name,
            image,
            provider,
            providerId,
            role: role || 'DOG_OWNER'
        });
        // NOTE: Empty field creation removed - fields are now created dynamically
        // when the field owner first saves their field details.
        // See comment in register method for more details.
        // Store OAuth account info
        const account = await _usermodel.default.hasOAuthAccount(user.id);
        if (!account) {
        // Create account record for tracking OAuth provider
        // This would typically be done in a separate Account model
        // For now, we're just tracking the provider in the User model
        }
        // Generate JWT token
        const token = _jsonwebtoken.default.sign({
            id: user.id,
            email: user.email,
            role: user.role,
            provider: user.provider
        }, _constants.JWT_SECRET, {
            expiresIn: _constants.JWT_EXPIRES_IN
        });
        res.json({
            success: true,
            message: 'Social login successful',
            data: {
                user,
                token
            }
        });
    });
    // Update user role (for OAuth users who selected role after account creation)
    updateRole = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const { email, role } = req.body;
        const userId = req.user?.id;
        // Validate input
        if (!email || !role) {
            throw new _AppError.AppError('Email and role are required', 400);
        }
        // Validate role
        const validRoles = [
            'DOG_OWNER',
            'FIELD_OWNER'
        ];
        if (!validRoles.includes(role)) {
            throw new _AppError.AppError('Invalid role specified', 400);
        }
        // Verify the user is updating their own role
        const user = await _usermodel.default.findByEmail(email);
        if (!user) {
            throw new _AppError.AppError('User not found', 404);
        }
        if (user.id !== userId) {
            throw new _AppError.AppError('You can only update your own role', 403);
        }
        // Update the user's role
        const updatedUser = await _usermodel.default.updateRole(user.id, role);
        // NOTE: Empty field creation removed - fields are now created dynamically
        // when the field owner first saves their field details.
        // See comment in register method for more details.
        // Generate new token with updated role
        const token = _jsonwebtoken.default.sign({
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role
        }, _constants.JWT_SECRET, {
            expiresIn: _constants.JWT_EXPIRES_IN
        });
        res.json({
            success: true,
            message: 'Role updated successfully',
            data: {
                user: updatedUser,
                token
            }
        });
    });
}
const _default = new AuthController();

//# sourceMappingURL=auth.controller.js.map