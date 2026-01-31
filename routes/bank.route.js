import { Router } from 'express';
import {
  createBank,
  getBanks,
  getBankById,
  updateBank,
  updateBankStatus,
  sendBankEmail,
  deleteBank,
} from '../controllers/bank.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const bankRouter = Router();

// All routes require authentication
bankRouter.use(authenticate);

// CRUD operations
bankRouter.post('/', requireRole('super_admin'), createBank);
bankRouter.get('/', getBanks);
bankRouter.get('/:id', getBankById);
bankRouter.put('/:id', requireRole('super_admin'), updateBank);
bankRouter.delete('/:id', requireRole('super_admin'), deleteBank);
bankRouter.put('/:id/status', requireRole('super_admin'), updateBankStatus);

// Send email to bank
bankRouter.post('/:id/send-email', requireRole('relationship_manager'), sendBankEmail);

export default bankRouter;
