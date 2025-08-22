import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const prisma = new PrismaClient();

// Submit a field claim
export const submitFieldClaim = asyncHandler(async (req: Request, res: Response) => {
  const {
    fieldId,
    fullName,
    email,
    phoneCode,
    phoneNumber,
    isLegalOwner,
    documents
  } = req.body;

  // Validate required fields
  if (!fieldId || !fullName || !email || !phoneNumber || isLegalOwner === undefined || !documents || documents.length === 0) {
    throw new AppError('All fields are required', 400);
  }

  // Check if field exists
  const field = await prisma.field.findUnique({
    where: { id: fieldId }
  });

  if (!field) {
    throw new AppError('Field not found', 404);
  }

  // Check if there's already a pending claim for this field
  const existingClaim = await prisma.fieldClaim.findFirst({
    where: {
      fieldId,
      status: 'PENDING'
    }
  });

  if (existingClaim) {
    throw new AppError('There is already a pending claim for this field', 400);
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
export const getAllClaims = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: any = {};
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
export const getClaimById = asyncHandler(async (req: Request, res: Response) => {
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
    throw new AppError('Claim not found', 404);
  }

  res.json({
    success: true,
    data: claim
  });
});

// Update claim status (admin only)
export const updateClaimStatus = asyncHandler(async (req: Request, res: Response) => {
  const { claimId } = req.params;
  const { status, reviewNotes } = req.body;
  const reviewerId = (req as any).user._id || (req as any).user.id;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const claim = await prisma.fieldClaim.findUnique({
    where: { id: claimId }
  });

  if (!claim) {
    throw new AppError('Claim not found', 404);
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
export const getFieldClaims = asyncHandler(async (req: Request, res: Response) => {
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