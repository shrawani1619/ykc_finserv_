import { Router } from 'express';
import {
  createFranchise,
  getFranchises,
  getFranchiseById,
  updateFranchise,
  updateFranchiseStatus,
  getFranchiseAgents,
  getFranchisePerformance,
  getActiveFranchises,
  deleteFranchise,
} from '../controllers/franchise.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const franchiseRouter = Router();

// Public route - Get active franchises for signup
franchiseRouter.get('/active', getActiveFranchises);

// All other routes require authentication
franchiseRouter.use(authenticate);

// CRUD operations
franchiseRouter.post('/', requireRole('super_admin', 'franchise_manager', 'relationship_manager'), createFranchise);
franchiseRouter.get('/', getFranchises);
franchiseRouter.get('/:id', getFranchiseById);
franchiseRouter.put('/:id', requireRole('super_admin', 'franchise_manager', 'relationship_manager'), updateFranchise);
franchiseRouter.delete('/:id', requireRole('super_admin', 'relationship_manager'), deleteFranchise);
franchiseRouter.put('/:id/status', requireRole('super_admin', 'franchise_manager', 'relationship_manager'), updateFranchiseStatus);

// Franchise agents
franchiseRouter.get('/:id/agents', requireRole('super_admin', 'franchise_manager', 'franchise_owner'), getFranchiseAgents);

// Franchise performance
franchiseRouter.get('/:id/performance', requireRole('super_admin', 'franchise_manager'), getFranchisePerformance);

export default franchiseRouter;
