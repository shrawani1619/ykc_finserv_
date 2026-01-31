import { Router } from 'express';
import {
  getAgentDashboard,
  getStaffDashboard,
  getAccountsDashboard,
  getAdminDashboard,
  getFranchiseOwnerDashboard,
} from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const dashboardRouter = Router();

// All routes require authentication
dashboardRouter.use(authenticate);

// Role-based dashboards
dashboardRouter.get('/agent', requireRole('agent'), getAgentDashboard);
dashboardRouter.get('/staff', requireRole('relationship_manager', 'franchise_manager'), getStaffDashboard);
dashboardRouter.get('/accounts', requireRole('accounts_manager'), getAccountsDashboard);
dashboardRouter.get('/admin', requireRole('super_admin'), getAdminDashboard);
dashboardRouter.get('/franchise-owner', requireRole('franchise_owner'), getFranchiseOwnerDashboard);

export default dashboardRouter;
