import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Get dashboard data (role-specific)
router.get('/', dashboardController.getDashboard);

// Get user permissions
router.get('/permissions', dashboardController.getPermissions);

export default router;
