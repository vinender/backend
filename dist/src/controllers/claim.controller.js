"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get checkClaimEligibility () {
        return checkClaimEligibility;
    },
    get getAllClaims () {
        return getAllClaims;
    },
    get getClaimById () {
        return getClaimById;
    },
    get getFieldClaims () {
        return getFieldClaims;
    },
    get submitFieldClaim () {
        return submitFieldClaim;
    },
    get updateClaimStatus () {
        return updateClaimStatus;
    }
});
const _client = require("@prisma/client");
const _asyncHandler = require("../utils/asyncHandler");
const _AppError = require("../utils/AppError");
const _emailservice = require("../services/email.service");
const prisma = new _client.PrismaClient();
const submitFieldClaim = (0, _asyncHandler.asyncHandler)(async (req, res)=>{
    const { fieldId, fullName, email, phoneCode, phoneNumber, isLegalOwner, documents } = req.body;
    // Validate required fields
    if (!fieldId || !fullName || !email || !phoneNumber || isLegalOwner === undefined || !documents || documents.length === 0) {
        throw new _AppError.AppError('All fields are required', 400);
    }
    // Check if field exists
    const field = await prisma.field.findUnique({
        where: {
            id: fieldId
        }
    });
    if (!field) {
        throw new _AppError.AppError('Field not found', 404);
    }
    // Check if field is already claimed (approved)
    if (field.isClaimed) {
        throw new _AppError.AppError('This field has already been claimed and verified', 400);
    }
    // Check if there's already an APPROVED claim for this field
    const approvedClaim = await prisma.fieldClaim.findFirst({
        where: {
            fieldId,
            status: 'APPROVED'
        }
    });
    if (approvedClaim) {
        throw new _AppError.AppError('This field has already been claimed and approved', 400);
    }
    // Check if this specific user already has a pending claim for this field
    const existingUserClaim = await prisma.fieldClaim.findFirst({
        where: {
            fieldId,
            email,
            status: 'PENDING'
        }
    });
    if (existingUserClaim) {
        throw new _AppError.AppError('You already have a pending claim for this field. Please wait for the review to complete.', 400);
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
                    address: true,
                    city: true,
                    state: true
                }
            }
        }
    });
    // Send confirmation email to the claimer
    try {
        const fieldAddress = field.address ? `${field.address}${field.city ? ', ' + field.city : ''}${field.state ? ', ' + field.state : ''}` : 'Address not specified';
        const fullPhoneNumber = `${phoneCode} ${phoneNumber}`;
        await _emailservice.emailService.sendFieldClaimEmail({
            fullName,
            email,
            phoneNumber: fullPhoneNumber,
            fieldName: field.name || 'Unnamed Field',
            fieldAddress: fieldAddress,
            isLegalOwner,
            submittedAt: claim.createdAt,
            documents: documents // Pass the documents array
        });
    } catch (emailError) {
        // Log error but don't fail the claim submission
        console.error('Failed to send field claim email:', emailError);
    }
    res.status(201).json({
        success: true,
        message: 'Claim submitted successfully. A confirmation email has been sent to your registered email address.',
        data: claim
    });
});
const getAllClaims = (0, _asyncHandler.asyncHandler)(async (req, res)=>{
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
        prisma.fieldClaim.count({
            where
        })
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
const getClaimById = (0, _asyncHandler.asyncHandler)(async (req, res)=>{
    const { claimId } = req.params;
    const claim = await prisma.fieldClaim.findUnique({
        where: {
            id: claimId
        },
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
        throw new _AppError.AppError('Claim not found', 404);
    }
    res.json({
        success: true,
        data: claim
    });
});
const updateClaimStatus = (0, _asyncHandler.asyncHandler)(async (req, res)=>{
    const { claimId } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewerId = req.user._id || req.user.id;
    if (![
        'APPROVED',
        'REJECTED'
    ].includes(status)) {
        throw new _AppError.AppError('Invalid status', 400);
    }
    const claim = await prisma.fieldClaim.findUnique({
        where: {
            id: claimId
        },
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
        }
    });
    if (!claim) {
        throw new _AppError.AppError('Claim not found', 404);
    }
    // Update the claim
    const updatedClaim = await prisma.fieldClaim.update({
        where: {
            id: claimId
        },
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
            where: {
                id: claim.fieldId
            },
            data: {
                isClaimed: true
            }
        });
    }
    // Send email notification about status update
    try {
        const fieldAddress = claim.field.address ? `${claim.field.address}${claim.field.city ? ', ' + claim.field.city : ''}${claim.field.state ? ', ' + claim.field.state : ''}` : 'Address not specified';
        await _emailservice.emailService.sendFieldClaimStatusEmail({
            email: claim.email,
            fullName: claim.fullName,
            fieldName: claim.field.name || 'Unnamed Field',
            fieldAddress: fieldAddress,
            status: status,
            reviewNotes: reviewNotes,
            documents: claim.documents // Include the documents array
        });
    } catch (emailError) {
        // Log error but don't fail the status update
        console.error('Failed to send field claim status email:', emailError);
    }
    res.json({
        success: true,
        message: `Claim ${status.toLowerCase()} successfully. An email notification has been sent to the claimer.`,
        data: updatedClaim
    });
});
const checkClaimEligibility = (0, _asyncHandler.asyncHandler)(async (req, res)=>{
    const { fieldId } = req.params;
    const { email } = req.query;
    // Check if field exists
    const field = await prisma.field.findUnique({
        where: {
            id: fieldId
        }
    });
    if (!field) {
        throw new _AppError.AppError('Field not found', 404);
    }
    // Check if field is already claimed
    if (field.isClaimed) {
        return res.json({
            success: true,
            canClaim: false,
            reason: 'This field has already been claimed and verified'
        });
    }
    // Check if there's an approved claim
    const approvedClaim = await prisma.fieldClaim.findFirst({
        where: {
            fieldId,
            status: 'APPROVED'
        }
    });
    if (approvedClaim) {
        return res.json({
            success: true,
            canClaim: false,
            reason: 'This field has already been claimed and approved'
        });
    }
    // If email is provided, check if this user already has a pending claim
    if (email) {
        const userClaim = await prisma.fieldClaim.findFirst({
            where: {
                fieldId,
                email: email,
                status: 'PENDING'
            }
        });
        if (userClaim) {
            return res.json({
                success: true,
                canClaim: false,
                reason: 'You already have a pending claim for this field',
                userHasPendingClaim: true
            });
        }
    }
    // Count total pending claims for this field
    const pendingClaimsCount = await prisma.fieldClaim.count({
        where: {
            fieldId,
            status: 'PENDING'
        }
    });
    res.json({
        success: true,
        canClaim: true,
        pendingClaimsCount,
        message: pendingClaimsCount > 0 ? `This field has ${pendingClaimsCount} pending claim(s) under review. You can still submit your claim.` : 'You can claim this field'
    });
});
const getFieldClaims = (0, _asyncHandler.asyncHandler)(async (req, res)=>{
    const { fieldId } = req.params;
    const claims = await prisma.fieldClaim.findMany({
        where: {
            fieldId
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    res.json({
        success: true,
        data: claims
    });
});

//# sourceMappingURL=claim.controller.js.map