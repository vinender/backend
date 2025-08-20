import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5),
    title: z.string().optional(),
    comment: z.string().min(10).max(1000),
    images: z.array(z.string().url()).optional().default([]),
  }),
});

export const updateReviewSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5).optional(),
    title: z.string().optional(),
    comment: z.string().min(10).max(1000).optional(),
    images: z.array(z.string().url()).optional(),
  }),
});

export const respondToReviewSchema = z.object({
  body: z.object({
    response: z.string().min(10).max(500),
  }),
});

export const getReviewsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.enum(['recent', 'helpful', 'rating_high', 'rating_low']).optional(),
    rating: z.string().optional(),
  }),
});