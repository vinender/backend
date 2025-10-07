"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderAmenities = exports.deleteAmenity = exports.updateAmenity = exports.createAmenity = exports.getAmenityById = exports.getAmenities = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Get all amenities (with optional filter for active only)
const getAmenities = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching amenities:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch amenities',
            error: error.message
        });
    }
};
exports.getAmenities = getAmenities;
// Get single amenity by ID
const getAmenityById = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching amenity:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch amenity',
            error: error.message
        });
    }
};
exports.getAmenityById = getAmenityById;
// Create new amenity (Admin only)
const createAmenity = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error creating amenity:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create amenity',
            error: error.message
        });
    }
};
exports.createAmenity = createAmenity;
// Update amenity (Admin only)
const updateAmenity = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error updating amenity:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update amenity',
            error: error.message
        });
    }
};
exports.updateAmenity = updateAmenity;
// Delete amenity (Admin only)
const deleteAmenity = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error deleting amenity:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete amenity',
            error: error.message
        });
    }
};
exports.deleteAmenity = deleteAmenity;
// Reorder amenities (Admin only)
const reorderAmenities = async (req, res) => {
    try {
        const { amenityOrders } = req.body; // Array of { id, order }
        if (!Array.isArray(amenityOrders)) {
            return res.status(400).json({
                success: false,
                message: 'amenityOrders must be an array'
            });
        }
        // Update all amenities with new order
        await Promise.all(amenityOrders.map(({ id, order }) => prisma.amenity.update({
            where: { id },
            data: { order }
        })));
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
    }
    catch (error) {
        console.error('Error reordering amenities:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reorder amenities',
            error: error.message
        });
    }
};
exports.reorderAmenities = reorderAmenities;
