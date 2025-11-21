//@ts-nocheck
import { Request, Response } from 'express';
import prisma from '../config/database';

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: {
    _id: string;
    id: string;
    userId?: string;
    role: string;
    email: string;
    name: string;
  };
}

export const userReportController = {
  async createReport(req: AuthRequest, res: Response) {
    try {
      const reporterId = req.user?.id;
      const { reportedUserId, reportOption, reason } = req.body;

      if (!reporterId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      if (!reportedUserId || !reportOption) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      const reporter = await prisma.user.findUnique({
        where: { id: reporterId }
      });

      if (!reporter) {
        return res.status(404).json({
          success: false,
          message: 'Reporter not found'
        });
      }

      const reportedUser = await prisma.user.findUnique({
        where: { id: reportedUserId }
      });

      if (!reportedUser) {
        return res.status(404).json({
          success: false,
          message: 'Reported user not found'
        });
      }

      // Both field owners and dog owners can report each other
      if (reporterId === reportedUserId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot report yourself'
        });
      }

      const existingReport = await prisma.userReport.findFirst({
        where: {
          reporterId,
          reportedUserId,
          status: 'pending'
        }
      });

      if (existingReport) {
        return res.status(400).json({
          success: false,
          message: 'You have already reported this user'
        });
      }

      const report = await prisma.userReport.create({
        data: {
          reporterId,
          reportedUserId,
          reportOption,
          reason
        }
      });

      await prisma.user.update({
        where: { id: reportedUserId },
        data: { isReported: true }
      });

      res.status(201).json({
        success: true,
        message: 'Report submitted successfully',
        data: report
      });
    } catch (error) {
      console.error('Create report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit report'
      });
    }
  },

  async getReports(req: AuthRequest, res: Response) {
    try {
      const { status, reporterId, reportedUserId } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;
      if (reporterId) where.reporterId = reporterId;
      if (reportedUserId) where.reportedUserId = reportedUserId;

      const [reports, total] = await Promise.all([
        prisma.userReport.findMany({
          where,
          include: {
            reporter: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true
              }
            },
            reportedUser: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                phone: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        prisma.userReport.count({ where })
      ]);

      res.json({
        success: true,
        data: reports,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reports'
      });
    }
  },

  async getReportDetails(req: AuthRequest, res: Response) {
    try {
      const { reportId } = req.params;

      const report = await prisma.userReport.findUnique({
        where: { id: reportId },
        include: {
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true
            }
          },
          reportedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              phone: true,
              role: true,
              createdAt: true
            }
          }
        }
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Get report details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch report details'
      });
    }
  },

  async updateReportStatus(req: AuthRequest, res: Response) {
    try {
      const { reportId } = req.params;
      const { status, reviewNotes } = req.body;
      const reviewedBy = req.user?.id;

      const user = await prisma.user.findUnique({
        where: { id: reviewedBy }
      });

      if (user?.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can update report status'
        });
      }

      const report = await prisma.userReport.update({
        where: { id: reportId },
        data: {
          status,
          reviewNotes,
          reviewedBy,
          reviewedAt: new Date()
        },
        include: {
          reporter: true,
          reportedUser: true
        }
      });

      if (status === 'resolved' || status === 'dismissed') {
        const allPendingReports = await prisma.userReport.count({
          where: {
            reportedUserId: report.reportedUserId,
            status: 'pending'
          }
        });

        if (allPendingReports === 0) {
          await prisma.user.update({
            where: { id: report.reportedUserId },
            data: { isReported: false }
          });
        }
      }

      res.json({
        success: true,
        message: 'Report status updated successfully',
        data: report
      });
    } catch (error) {
      console.error('Update report status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update report status'
      });
    }
  },

  async getMyReportsMade(req: AuthRequest, res: Response) {
    try {
      const reporterId = req.user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      if (!reporterId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const [reports, total] = await Promise.all([
        prisma.userReport.findMany({
          where: { reporterId },
          include: {
            reportedUser: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        prisma.userReport.count({ where: { reporterId } })
      ]);

      res.json({
        success: true,
        data: reports,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get my reports made error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch your reports'
      });
    }
  }
};
