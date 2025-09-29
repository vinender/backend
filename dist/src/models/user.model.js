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
const _database = /*#__PURE__*/ _interop_require_default(require("../config/database"));
const _bcryptjs = /*#__PURE__*/ _interop_require_default(require("bcryptjs"));
const _constants = require("../config/constants");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class UserModel {
    // Create a new user
    async create(data) {
        const hashedPassword = await _bcryptjs.default.hash(data.password, _constants.BCRYPT_ROUNDS);
        const role = data.role || 'DOG_OWNER';
        // Get default commission rate from system settings for field owners
        let commissionRate = undefined;
        if (role === 'FIELD_OWNER') {
            // Get system settings for default commission rate
            const settings = await _database.default.systemSettings.findFirst();
            commissionRate = settings?.defaultCommissionRate || 15.0; // Use 15% as fallback
        }
        return _database.default.user.create({
            data: {
                ...data,
                password: hashedPassword,
                role,
                provider: data.provider || 'general',
                commissionRate
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
                updatedAt: true
            }
        });
    }
    // Find user by email (returns first match, use for login without role)
    async findByEmail(email) {
        return _database.default.user.findFirst({
            where: {
                email
            }
        });
    }
    // Find user by email and role
    async findByEmailAndRole(email, role) {
        return _database.default.user.findUnique({
            where: {
                email_role: {
                    email,
                    role
                }
            }
        });
    }
    // Find user by phone
    async findByPhone(phone) {
        return _database.default.user.findFirst({
            where: {
                phone
            }
        });
    }
    // Find user by ID
    async findById(id) {
        return _database.default.user.findUnique({
            where: {
                id
            },
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
                createdAt: true,
                updatedAt: true
            }
        });
    }
    // Update user
    async update(id, data) {
        return _database.default.user.update({
            where: {
                id
            },
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
                updatedAt: true
            }
        });
    }
    // Delete user
    async delete(id) {
        return _database.default.user.delete({
            where: {
                id
            }
        });
    }
    // Verify password
    async verifyPassword(plainPassword, hashedPassword) {
        return _bcryptjs.default.compare(plainPassword, hashedPassword);
    }
    // Check if user has OAuth account
    async hasOAuthAccount(userId) {
        const account = await _database.default.account.findFirst({
            where: {
                userId
            }
        });
        return !!account;
    }
    // Get OAuth providers for a user
    async getOAuthProviders(userId) {
        const accounts = await _database.default.account.findMany({
            where: {
                userId
            },
            select: {
                provider: true
            }
        });
        return accounts.map((a)=>a.provider);
    }
    // Get all users (admin only)
    async findAll(skip = 0, take = 10) {
        return _database.default.user.findMany({
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
                updatedAt: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }
    // Create or update user from social login
    async createOrUpdateSocialUser(data) {
        const userRole = data.role || 'DOG_OWNER';
        // Check if user exists with same email and role
        const existingUser = await this.findByEmailAndRole(data.email, userRole);
        if (existingUser) {
            // Update existing user with social login info
            const updateData = {
                name: data.name || existingUser.name,
                // Keep user's uploaded image, store Google image separately
                image: existingUser.image,
                emailVerified: new Date(),
                provider: data.provider
            };
            // Store Google image separately if provider is Google
            if (data.provider === 'google' && data.image) {
                updateData.googleImage = data.image;
                // Only use Google image as primary if user has no uploaded image
                if (!existingUser.image) {
                    updateData.image = data.image;
                }
            }
            return _database.default.user.update({
                where: {
                    id: existingUser.id
                },
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
                    createdAt: true,
                    updatedAt: true
                }
            });
        }
        // Create new user from social login with specific role
        const createData = {
            email: data.email,
            name: data.name || data.email.split('@')[0],
            image: data.image,
            role: userRole,
            provider: data.provider,
            emailVerified: new Date()
        };
        // Store Google image separately if provider is Google
        if (data.provider === 'google' && data.image) {
            createData.googleImage = data.image;
        }
        return _database.default.user.create({
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
                createdAt: true,
                updatedAt: true
            }
        });
    }
    // Update user role
    async updateRole(id, role) {
        return _database.default.user.update({
            where: {
                id
            },
            data: {
                role
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
                createdAt: true,
                updatedAt: true
            }
        });
    }
}
const _default = new UserModel();

//# sourceMappingURL=user.model.js.map