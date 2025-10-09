//@ts-nocheck
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

class FieldPropertiesController {
  // GET /field-properties - Get all field properties with their options
  getAllFieldProperties = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const options = await prisma.fieldOption.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { order: 'asc' }
      ],
      select: {
        id: true,
        value: true,
        label: true,
        category: true,
        order: true
      }
    });

    // Group by category/field property
    const groupedData = options.reduce((acc: any, option) => {
      if (!acc[option.category]) {
        acc[option.category] = [];
      }
      acc[option.category].push({
        id: option.id,
        value: option.value,
        label: option.label,
        order: option.order
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedData
    });
  });

  // Get field options by property slug/category
  getFieldOptionsByProperty = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { property } = req.params;

    if (!property) {
      throw new AppError('Property slug is required', 400);
    }

    // Get all options for this category/property
    const options = await prisma.fieldOption.findMany({
      where: {
        category: property,
        isActive: true
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        value: true,
        label: true,
        order: true
      }
    });

    if (options.length === 0) {
      throw new AppError('No field options found for this property', 404);
    }

    res.json({
      success: true,
      data: options,
      fieldProperty: property
    });
  });

  // Admin: Get all field properties (including inactive)
  getAllFieldPropertiesAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      throw new AppError('Access denied. Admin only.', 403);
    }

    const { category, page = 1, limit = 50 } = req.query;

    const filter: any = {};
    if (category) {
      filter.category = category as string;
    }

    const [options, total] = await Promise.all([
      prisma.fieldOption.findMany({
        where: filter,
        orderBy: [
          { category: 'asc' },
          { order: 'asc' }
        ],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.fieldOption.count({ where: filter })
    ]);

    res.json({
      success: true,
      data: {
        options,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  });

  // Admin: Create field option
  createFieldOption = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      throw new AppError('Access denied. Admin only.', 403);
    }

    const { category, value, label, isActive = true, order = 0 } = req.body;

    if (!category || !value || !label) {
      throw new AppError('Category, value, and label are required', 400);
    }

    // Check if option already exists
    const existing = await prisma.fieldOption.findUnique({
      where: {
        category_value: {
          category,
          value
        }
      }
    });

    if (existing) {
      throw new AppError('Field option with this category and value already exists', 400);
    }

    const option = await prisma.fieldOption.create({
      data: {
        category,
        value,
        label,
        isActive,
        order
      }
    });

    res.status(201).json({
      success: true,
      message: 'Field option created successfully',
      data: option
    });
  });

  // Admin: Update field option
  updateFieldOption = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      throw new AppError('Access denied. Admin only.', 403);
    }

    const { id } = req.params;
    const { label, isActive, order } = req.body;

    const option = await prisma.fieldOption.findUnique({
      where: { id }
    });

    if (!option) {
      throw new AppError('Field option not found', 404);
    }

    const updated = await prisma.fieldOption.update({
      where: { id },
      data: {
        ...(label && { label }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(typeof order === 'number' && { order })
      }
    });

    res.json({
      success: true,
      message: 'Field option updated successfully',
      data: updated
    });
  });

  // Admin: Delete field option
  deleteFieldOption = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      throw new AppError('Access denied. Admin only.', 403);
    }

    const { id } = req.params;

    const option = await prisma.fieldOption.findUnique({
      where: { id }
    });

    if (!option) {
      throw new AppError('Field option not found', 404);
    }

    await prisma.fieldOption.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Field option deleted successfully'
    });
  });

  // Admin: Bulk update order
  updateFieldPropertiesOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;

    if (userRole !== 'ADMIN') {
      throw new AppError('Access denied. Admin only.', 403);
    }

    const { updates } = req.body; // Array of { id, order }

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError('Updates array is required', 400);
    }

    // Bulk update
    await Promise.all(
      updates.map(({ id, order }) =>
        prisma.fieldOption.update({
          where: { id },
          data: { order }
        })
      )
    );

    res.json({
      success: true,
      message: 'Field properties order updated successfully'
    });
  });
}

export default new FieldPropertiesController();
