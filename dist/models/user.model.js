"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-nocheck
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const constants_1 = require("../config/constants");
class UserModel {
    // Create a new user
    async create(data) {
        const hashedPassword = await bcryptjs_1.default.hash(data.password, constants_1.BCRYPT_ROUNDS);
        const role = data.role || 'DOG_OWNER';
        // Get default commission rate from system settings for field owners
        let commissionRate = undefined;
        if (role === 'FIELD_OWNER') {
            // Get system settings for default commission rate
            const settings = await database_1.default.systemSettings.findFirst();
            commissionRate = settings?.defaultCommissionRate || 15.0; // Use 15% as fallback
        }
        return database_1.default.user.create({
            data: {
                ...data,
                password: hashedPassword,
                role,
                provider: data.provider || 'general',
                commissionRate,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                provider: true,
                image: true,
                googleImage: true,
                commissionRate: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    // Find user by email (returns first match, use for login without role)
    async findByEmail(email) {
        return database_1.default.user.findFirst({
            where: { email },
        });
    }
    // Find user by email and role
    async findByEmailAndRole(email, role) {
        return database_1.default.user.findUnique({
            where: {
                email_role: {
                    email,
                    role
                }
            },
        });
    }
    // Find user by phone
    async findByPhone(phone) {
        return database_1.default.user.findFirst({
            where: { phone },
        });
    }
    // Find user by ID
    async findById(id) {
        return database_1.default.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                bio: true,
                image: true,
                googleImage: true,
                provider: true,
                emailVerified: true,
                hasField: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    // Update user
    async update(id, data) {
        return database_1.default.user.update({
            where: { id },
            data,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                bio: true,
                image: true,
                googleImage: true,
                provider: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    // Delete user
    async delete(id) {
        return database_1.default.user.delete({
            where: { id },
        });
    }
    // Verify password
    async verifyPassword(plainPassword, hashedPassword) {
        return bcryptjs_1.default.compare(plainPassword, hashedPassword);
    }
    // Check if user has OAuth account
    async hasOAuthAccount(userId) {
        const account = await database_1.default.account.findFirst({
            where: { userId },
        });
        return !!account;
    }
    // Get OAuth providers for a user
    async getOAuthProviders(userId) {
        const accounts = await database_1.default.account.findMany({
            where: { userId },
            select: { provider: true },
        });
        return accounts.map(a => a.provider);
    }
    // Get all users (admin only)
    async findAll(skip = 0, take = 10) {
        return database_1.default.user.findMany({
            skip,
            take,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                image: true,
                googleImage: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    // Create or update user from social login
    async createOrUpdateSocialUser(data) {
        const userRole = data.role || 'DOG_OWNER';
        // Check if user exists with same email (regardless of role)
        const existingUser = await this.findByEmail(data.email);
        if (existingUser) {
            // Check if the existing user has a different role
            if (existingUser.role !== userRole) {
                throw new Error(`An account already exists with this email.`);
            }
            // Update existing user with social login info
            const updateData = {
                name: data.name || existingUser.name,
                // Keep user's uploaded image, store Google image separately
                image: existingUser.image, // Keep existing uploaded image
                emailVerified: true, // Auto-verify when logging in with social provider
                provider: data.provider, // Update provider to track social login
            };
            // Store Google image separately if provider is Google
            if (data.provider === 'google' && data.image) {
                updateData.googleImage = data.image;
                // Only use Google image as primary if user has no uploaded image
                if (!existingUser.image) {
                    updateData.image = data.image;
                }
            }
            return database_1.default.user.update({
                where: { id: existingUser.id },
                data: updateData,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    phone: true,
                    provider: true,
                    image: true,
                    googleImage: true,
                    emailVerified: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
        }
        // Create new user from social login with specific role
        const createData = {
            email: data.email,
            name: data.name || data.email.split('@')[0],
            image: data.image,
            role: userRole,
            provider: data.provider,
            emailVerified: true, // Social logins are automatically verified
        };
        // Store Google image separately if provider is Google
        if (data.provider === 'google' && data.image) {
            createData.googleImage = data.image;
        }
        return database_1.default.user.create({
            data: createData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                provider: true,
                image: true,
                googleImage: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    // Update user role
    async updateRole(id, role) {
        return database_1.default.user.update({
            where: { id },
            data: { role },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                provider: true,
                image: true,
                googleImage: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
}
exports.default = new UserModel();
