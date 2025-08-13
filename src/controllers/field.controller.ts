import { Request, Response, NextFunction } from 'express';
import FieldModel from '../models/field.model';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

class FieldController {
  // Create new field
  createField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Only field owners can create fields
    if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
      throw new AppError('Only field owners can create fields', 403);
    }

    const fieldData = {
      ...req.body,
      ownerId,
    };

    const field = await FieldModel.create(fieldData);

    res.status(201).json({
      success: true,
      message: 'Field created successfully',
      data: field,
    });
  });

  // Get all fields with filters
  getAllFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
      city,
      state,
      type,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const fields = await FieldModel.findAll({
      city: city as string,
      state: state as string,
      type: type as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      skip,
      take: Number(limit),
    });

    res.json({
      success: true,
      data: fields,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: fields.length,
      },
    });
  });

  // Get field by ID
  getField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const field = await FieldModel.findById(id);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    res.json({
      success: true,
      data: field,
    });
  });

  // Get fields by owner
  getMyFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;

    const fields = await FieldModel.findByOwner(ownerId);

    res.json({
      success: true,
      data: fields,
      total: fields.length,
    });
  });

  // Update field
  updateField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check ownership
    const field = await FieldModel.findById(id);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    if (field.ownerId !== userId && userRole !== 'ADMIN') {
      throw new AppError('You can only update your own fields', 403);
    }

    // Prevent updating certain fields
    delete req.body.id;
    delete req.body.ownerId;

    const updatedField = await FieldModel.update(id, req.body);

    res.json({
      success: true,
      message: 'Field updated successfully',
      data: updatedField,
    });
  });

  // Delete field
  deleteField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check ownership
    const field = await FieldModel.findById(id);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    if (field.ownerId !== userId && userRole !== 'ADMIN') {
      throw new AppError('You can only delete your own fields', 403);
    }

    await FieldModel.delete(id);

    res.status(204).json({
      success: true,
      message: 'Field deleted successfully',
    });
  });

  // Toggle field active status
  toggleFieldStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check ownership
    const field = await FieldModel.findById(id);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    if (field.ownerId !== userId && userRole !== 'ADMIN') {
      throw new AppError('You can only toggle your own fields', 403);
    }

    const updatedField = await FieldModel.toggleActive(id);

    res.json({
      success: true,
      message: `Field ${updatedField.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedField,
    });
  });

  // Search fields by location
  searchByLocation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      throw new AppError('Latitude and longitude are required', 400);
    }

    const fields = await FieldModel.searchByLocation(
      Number(lat),
      Number(lng),
      Number(radius)
    );

    res.json({
      success: true,
      data: fields,
      total: fields.length,
    });
  });
}

export default new FieldController();