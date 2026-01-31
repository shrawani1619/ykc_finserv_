import { Router } from 'express';
import {
  getInvoices,
  getInvoiceById,
  acceptInvoice,
  escalateInvoice,
  resolveEscalation,
  approveInvoice,
  rejectInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
} from '../controllers/invoice.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const invoiceRouter = Router();

// All routes require authentication
invoiceRouter.use(authenticate);

// CRUD operations
invoiceRouter.post('/', requireRole('super_admin', 'relationship_manager'), createInvoice);
invoiceRouter.get('/', getInvoices);
invoiceRouter.get('/:id', getInvoiceById);
invoiceRouter.put('/:id', requireRole('super_admin', 'relationship_manager'), updateInvoice);
invoiceRouter.delete('/:id', requireRole('super_admin', 'relationship_manager'), deleteInvoice);

// Agent actions
invoiceRouter.post('/:id/accept', requireRole('agent'), acceptInvoice);
invoiceRouter.post('/:id/escalate', requireRole('agent'), escalateInvoice);

// Staff/Franchise Owner actions
invoiceRouter.post('/:id/resolve', requireRole('relationship_manager', 'franchise_owner', 'franchise_manager'), resolveEscalation);
invoiceRouter.post('/:id/approve', requireRole('relationship_manager', 'accounts_manager', 'franchise_owner'), approveInvoice);
invoiceRouter.post('/:id/reject', requireRole('relationship_manager', 'accounts_manager', 'franchise_owner'), rejectInvoice);

export default invoiceRouter;
