import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all amenities (with optional filter for active only)
export const getAmenities = async (req: Request, res: Response) => {
  try {
    const { activeOnly } = req.query;

    const where = activeOnly === 'true' ? { isActive: true } : {};

    const amenities = await prisma.amenity.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    });

    return res.status(200).json({
      success: true,
      message: amenities.length === 0 ? 'No amenities found' : 'Amenities retrieved successfully',
      data: amenities
    });
  } catch (error: any) {
    console.error('Error fetching amenities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch amenities',
      error: error.message
    });
  }
};

// Get single amenity by ID
export const getAmenityById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const amenity = await prisma.amenity.findUnique({
      where: { id }
    });

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: amenity
    });
  } catch (error: any) {
    console.error('Error fetching amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch amenity',
      error: error.message
    });
  }
};

// Create new amenity (Admin only)
export const createAmenity = async (req: Request, res: Response) => {
  try {
    const { name, icon, order, isActive } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Amenity name is required'
      });
    }

    // Check if amenity with same name exists
    const existingAmenity = await prisma.amenity.findUnique({
      where: { name }
    });

    if (existingAmenity) {
      return res.status(400).json({
        success: false,
        message: 'An amenity with this name already exists'
      });
    }

    const amenity = await prisma.amenity.create({
      data: {
        name,
        icon: icon || null,
        order: order || 0,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Amenity created successfully',
      data: amenity
    });
  } catch (error: any) {
    console.error('Error creating amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create amenity',
      error: error.message
    });
  }
};

// Update amenity (Admin only)
export const updateAmenity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon, order, isActive } = req.body;

    // Check if amenity exists
    const existingAmenity = await prisma.amenity.findUnique({
      where: { id }
    });

    if (!existingAmenity) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    // If name is being updated, check for duplicates
    if (name && name !== existingAmenity.name) {
      const duplicateAmenity = await prisma.amenity.findUnique({
        where: { name }
      });

      if (duplicateAmenity) {
        return res.status(400).json({
          success: false,
          message: 'An amenity with this name already exists'
        });
      }
    }

    const amenity = await prisma.amenity.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Amenity updated successfully',
      data: amenity
    });
  } catch (error: any) {
    console.error('Error updating amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update amenity',
      error: error.message
    });
  }
};

// Delete amenity (Admin only)
export const deleteAmenity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if amenity exists
    const existingAmenity = await prisma.amenity.findUnique({
      where: { id }
    });

    if (!existingAmenity) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    await prisma.amenity.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Amenity deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete amenity',
      error: error.message
    });
  }
};

// Reorder amenities (Admin only)
export const reorderAmenities = async (req: Request, res: Response) => {
  try {
    const { amenityOrders } = req.body; // Array of { id, order }

    if (!Array.isArray(amenityOrders)) {
      return res.status(400).json({
        success: false,
        message: 'amenityOrders must be an array'
      });
    }

    // Update all amenities with new order
    await Promise.all(
      amenityOrders.map(({ id, order }) =>
        prisma.amenity.update({
          where: { id },
          data: { order }
        })
      )
    );

    const updatedAmenities = await prisma.amenity.findMany({
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    });

    return res.status(200).json({
      success: true,
      message: 'Amenities reordered successfully',
      data: updatedAmenities
    });
  } catch (error: any) {
    console.error('Error reordering amenities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder amenities',
      error: error.message
    });
  }
};
