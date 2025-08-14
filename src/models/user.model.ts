import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../config/constants';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: 'DOG_OWNER' | 'FIELD_OWNER' | 'ADMIN';
  phone?: string;
  provider?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  bio?: string;
  image?: string;
}

class UserModel {
  // Create a new user
  async create(data: CreateUserInput) {
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    
    return prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role || 'DOG_OWNER',
        provider: data.provider || 'general',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Find user by email
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  // Find user by phone
  async findByPhone(phone: string) {
    return prisma.user.findFirst({
      where: { phone },
    });
  }

  // Find user by ID
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        bio: true,
        image: true,
        provider: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Update user
  async update(id: string, data: UpdateUserInput) {
    return prisma.user.update({
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
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Delete user
  async delete(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  // Verify password
  async verifyPassword(plainPassword: string, hashedPassword: string) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Check if user has OAuth account
  async hasOAuthAccount(userId: string) {
    const account = await prisma.account.findFirst({
      where: { userId },
    });
    return !!account;
  }

  // Get OAuth providers for a user
  async getOAuthProviders(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { provider: true },
    });
    return accounts.map(a => a.provider);
  }

  // Get all users (admin only)
  async findAll(skip = 0, take = 10) {
    return prisma.user.findMany({
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Create or update user from social login
  async createOrUpdateSocialUser(data: {
    email: string;
    name?: string;
    image?: string;
    provider: string;
    providerId: string;
    role?: 'DOG_OWNER' | 'FIELD_OWNER' | 'ADMIN';
  }) {
    // Check if user exists
    const existingUser = await this.findByEmail(data.email);
    
    if (existingUser) {
      // If user exists but doesn't have a provider set (first social login)
      // we should update their role if provided
      const updateData: any = {
        name: data.name || existingUser.name,
        image: data.image || existingUser.image,
        emailVerified: new Date(), // Social logins are verified
        provider: data.provider, // Update provider to track social login
      };
      
      // Only update role if:
      // 1. User doesn't have a provider set (first social login)
      // 2. A role was explicitly provided
      // 3. User's current role is still the default DOG_OWNER
      if (!existingUser.provider && data.role && existingUser.role === 'DOG_OWNER') {
        updateData.role = data.role;
      }
      
      return prisma.user.update({
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
          createdAt: true,
          updatedAt: true,
        },
      });
    }
    
    // Create new user from social login
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name || data.email.split('@')[0],
        image: data.image,
        role: data.role || 'DOG_OWNER',
        provider: data.provider,
        emailVerified: new Date(), // Social logins are verified
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        provider: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  // Update user role
  async updateRole(id: string, role: 'DOG_OWNER' | 'FIELD_OWNER' | 'ADMIN') {
    return prisma.user.update({
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
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}

export default new UserModel();