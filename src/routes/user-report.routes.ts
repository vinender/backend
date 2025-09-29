//@ts-nocheck
import { Router } from 'express';
import { userReportController } from '../controllers/user-report.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/report', protect, userReportController.createReport);

router.get('/reports', protect, userReportController.getReports);

router.get('/reports/my-reports', protect, userReportController.getMyReportsMade);

router.get('/reports/:reportId', protect, userReportController.getReportDetails);

router.put('/reports/:reportId/status', protect, userReportController.updateReportStatus);

export default router;
