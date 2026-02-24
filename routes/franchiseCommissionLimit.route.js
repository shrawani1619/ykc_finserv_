import { Router } from 'express';
import {
  getFranchiseCommissionLimits,
  getFranchiseCommissionLimitById,
  getFranchiseCommissionLimitByBank,
  createFranchiseCommissionLimit,
  updateFranchiseCommissionLimit,
  deleteFranchiseCommissionLimit,
} from '../controllers/franchiseCommissionLimit.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const franchiseCommissionLimitRouter = Router();

// All routes require authentication and admin or accounts_manager role
franchiseCommissionLimitRouter.use(authenticate);
franchiseCommissionLimitRouter.use(requireRole('super_admin', 'accounts_manager'));

// CRUD operations
franchiseCommissionLimitRouter.get('/', getFranchiseCommissionLimits);
franchiseCommissionLimitRouter.get('/bank/:bankId', getFranchiseCommissionLimitByBank);
franchiseCommissionLimitRouter.get('/:id', getFranchiseCommissionLimitById);
franchiseCommissionLimitRouter.post('/', createFranchiseCommissionLimit);
franchiseCommissionLimitRouter.put('/:id', updateFranchiseCommissionLimit);
franchiseCommissionLimitRouter.delete('/:id', deleteFranchiseCommissionLimit);

export default franchiseCommissionLimitRouter;

