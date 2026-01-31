import { Router } from 'express';
import {
  getPayouts,
  getPayoutById,
  processPayouts,
  generateBankCsvFile,
  confirmPayment,
  createPayout,
  updatePayout,
  deletePayout,
} from '../controllers/payout.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const payoutRouter = Router();

// All routes require authentication
payoutRouter.use(authenticate);

// CRUD operations
payoutRouter.post('/', requireRole('super_admin', 'accounts_manager', 'relationship_manager'), createPayout);
payoutRouter.get('/', getPayouts);
payoutRouter.get('/:id', getPayoutById);
payoutRouter.put('/:id', requireRole('super_admin', 'accounts_manager', 'relationship_manager'), updatePayout);
payoutRouter.delete('/:id', requireRole('super_admin', 'accounts_manager', 'relationship_manager'), deletePayout);

// Accounts manager actions
payoutRouter.post('/process', requireRole('accounts_manager'), processPayouts);
payoutRouter.post('/:id/generate-csv', requireRole('accounts_manager'), generateBankCsvFile);
payoutRouter.post('/:id/confirm', requireRole('accounts_manager'), confirmPayment);

export default payoutRouter;
