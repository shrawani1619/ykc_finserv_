import { Router } from 'express';
import {
  getCommissionRules,
  createCommissionRule,
  updateCommissionRule,
  calculateCommission,
} from '../controllers/commission.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const commissionRouter = Router();

// All routes require authentication
commissionRouter.use(authenticate);

// Get all commission rules
commissionRouter.get('/rules', getCommissionRules);

// Calculate commission for a lead
commissionRouter.post('/calculate/:id', calculateCommission);

// Admin/Manager actions
commissionRouter.post('/rules', requireRole('super_admin', 'franchise_manager'), createCommissionRule);
commissionRouter.put('/rules/:id', requireRole('super_admin', 'franchise_manager'), updateCommissionRule);

export default commissionRouter;
