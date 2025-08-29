"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFieldClaims = exports.updateClaimStatus = exports.getClaimById = exports.getAllClaims = exports.submitFieldClaim = void 0;
const client_1 = require("@prisma/client");
const asyncHandler_1 = require("../utils/asyncHandler");
const AppError_1 = require("../utils/AppError");
const prisma = new client_1.PrismaClient();
// Submit a field claim
exports.submitFieldClaim = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { fieldId, fullName, email, phoneCode, phoneNumber, isLegalOwner, documents } = req.body;
    // Validate required fields
    if (!fieldId || !fullName || !email || !phoneNumber || isLegalOwner === undefined || !documents || documents.length === 0) {
        throw new AppError_1.AppError('All fields are required', 400);
    }
    // Check if field exists
    const field = await prisma.field.findUnique({
        where: { id: fieldId }
    });
    if (!field) {
        throw new AppError_1.AppError('Field not found', 404);
    }
    // Check if there's already a pending claim for this field
    const existingClaim = await prisma.fieldClaim.findFirst({
        where: {
            fieldId,
            status: 'PENDING'
        }
    });
    if (existingClaim) {
        throw new AppError_1.AppError('There is already a pending claim for this field', 400);
    }
    // Create the claim
    const claim = await prisma.fieldClaim.create({
        data: {
            fieldId,
            fullName,
            email,
            phoneCode,
            phoneNumber,
            isLegalOwner,
            documents,
            status: 'PENDING'
        },
        include: {
            field: {
                select: {
                    id: true,
                    name: true,
                    address: true
                }
            }
        }
    });
    res.status(201).json({
        success: true,
        message: 'Claim submitted successfully',
        data: claim
    });
});
// Get all claims (admin only)
exports.getAllClaims = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};
    if (status) {
        where.status = status;
    }
    const [claims, total] = await Promise.all([
        prisma.fieldClaim.findMany({
            where,
            include: {
                field: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        state: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: Number(limit)
        }),
        prisma.fieldClaim.count({ where })
    ]);
    res.json({
        success: true,
        data: claims,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
        }
    });
});
// Get claim by ID
exports.getClaimById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { claimId } = req.params;
    const claim = await prisma.fieldClaim.findUnique({
        where: { id: claimId },
        include: {
            field: {
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            }
        }
    });
    if (!claim) {
        throw new AppError_1.AppError('Claim not found', 404);
    }
    res.json({
        success: true,
        data: claim
    });
});
// Update claim status (admin only)
exports.updateClaimStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { claimId } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewerId = req.user._id || req.user.id;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new AppError_1.AppError('Invalid status', 400);
    }
    const claim = await prisma.fieldClaim.findUnique({
        where: { id: claimId }
    });
    if (!claim) {
        throw new AppError_1.AppError('Claim not found', 404);
    }
    // Update the claim
    const updatedClaim = await prisma.fieldClaim.update({
        where: { id: claimId },
        data: {
            status,
            reviewNotes,
            reviewedAt: new Date(),
            reviewedBy: reviewerId
        }
    });
    // If approved, update the field's claim status
    if (status === 'APPROVED') {
        await prisma.field.update({
            where: { id: claim.fieldId },
            data: {
                isClaimed: true
            }
        });
    }
    res.json({
        success: true,
        message: `Claim ${status.toLowerCase()} successfully`,
        data: updatedClaim
    });
});
// Get claims for a specific field
exports.getFieldClaims = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { fieldId } = req.params;
    const claims = await prisma.fieldClaim.findMany({
        where: { fieldId },
        orderBy: {
            createdAt: 'desc'
        }
    });
    res.json({
        success: true,
        data: claims
    });
});
