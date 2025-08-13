import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../config/constants';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: 'DOG_OWNER' | 'FIELD_OWNER' | 'ADMIN';
  phone?: string;
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
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
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
}

export default new UserModel();