import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const prisma = new PrismaClient();

class FavoriteController {
  // Toggle favorite (save/unsave field)
  toggleFavorite = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fieldId } = req.params;
    const userId = (req as any).user.id;

    // Check if field exists
    const field = await prisma.field.findUnique({
      where: { id: fieldId }
    });

    if (!field) {
      throw new AppError('Field not found', 404);
    }

    // Check if already favorited
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_fieldId: {
          userId,
          fieldId
        }
      }
    });

    if (existingFavorite) {
      // Remove from favorites
      await prisma.favorite.delete({
        where: {
          id: existingFavorite.id
        }
      });

      res.json({
        success: true,
        message: 'Field removed from favorites',
        isFavorited: false
      });
    } else {
      // Add to favorites
      const favorite = await prisma.favorite.create({
        data: {
          userId,
          fieldId
        }
      });

      res.json({
        success: true,
        message: 'Field added to favorites',
        isFavorited: true,
        data: favorite
      });
    }
  });

  // Get user's saved fields
  getSavedFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const favorites = await prisma.favorite.findMany({
      where: {
        userId
      },
      include: {
        field: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            fieldReviews: {
              select: {
                rating: true
              }
            },
            _count: {
              select: {
                bookings: true,
                fieldReviews: true
              }
            }
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate average rating for each field
    const fieldsWithRating = favorites.map(fav => {
      const avgRating = fav.field.fieldReviews.length > 0
        ? fav.field.fieldReviews.reduce((sum, review) => sum + review.rating, 0) / fav.field.fieldReviews.length
        : 0;

      return {
        ...fav.field,
        averageRating: avgRating,
        reviewCount: fav.field._count.fieldReviews,
        bookingCount: fav.field._count.bookings,
        isFavorited: true
      };
    });

    const total = await prisma.favorite.count({
      where: { userId }
    });

    res.json({
      success: true,
      data: fieldsWithRating,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  // Check if field is favorited by user
  checkFavorite = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fieldId } = req.params;
    const userId = (req as any).user.id;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_fieldId: {
          userId,
          fieldId
        }
      }
    });

    res.json({
      success: true,
      isFavorited: !!favorite
    });
  });

  // Remove from favorites
  removeFavorite = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fieldId } = req.params;
    const userId = (req as any).user.id;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_fieldId: {
          userId,
          fieldId
        }
      }
    });

    if (!favorite) {
      throw new AppError('Field not in favorites', 404);
    }

    await prisma.favorite.delete({
      where: {
        id: favorite.id
      }
    });

    res.json({
      success: true,
      message: 'Field removed from favorites'
    });
  });
}

export default new FavoriteController();