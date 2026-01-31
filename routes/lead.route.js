import { Router } from 'express';
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  verifyLead,
  getLeadDocuments,
  uploadLeadDocument,
  deleteLead,
  getLeadHistory,
} from '../controllers/lead.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const leadRouter = Router();

// All routes require authentication
leadRouter.use(authenticate);

// CRUD operations
leadRouter.post('/', requireRole('agent'), createLead);
leadRouter.get('/', getLeads);
leadRouter.get('/:id', getLeadById);
leadRouter.put('/:id', updateLead);
leadRouter.delete('/:id', requireRole('super_admin', 'relationship_manager'), deleteLead);
leadRouter.put('/:id/status', updateLeadStatus);

// Verification (Staff/Franchise Owner)
leadRouter.post('/:id/verify', requireRole('relationship_manager', 'franchise_owner'), verifyLead);

// Document management
leadRouter.get('/:id/documents', getLeadDocuments);
leadRouter.post('/:id/documents', uploadLeadDocument);

// Version history (Admin and Franchise Owner only)
leadRouter.get('/:id/history', requireRole('super_admin', 'relationship_manager', 'franchise_owner'), getLeadHistory);

export default leadRouter;
