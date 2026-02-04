import { Router } from 'express';
import {
  uploadDocument,
  getDocuments,
  getDocumentById,
  verifyDocument,
  deleteDocument,
  downloadDocument,
} from '../controllers/document.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const documentRouter = Router();

// All routes require authentication
documentRouter.use(authenticate);

// Upload document
documentRouter.post('/', uploadDocument);

// Get documents for an entity
documentRouter.get('/:entityType/:entityId', getDocuments);

// Get document by ID
documentRouter.get('/:id', getDocumentById);

// Verify document (Staff/Franchise Owner)
documentRouter.post('/:id/verify', requireRole('relationship_manager', 'franchise'), verifyDocument);

// Delete document
documentRouter.delete('/:id', deleteDocument);

// Download document
documentRouter.get('/:id/download', downloadDocument);

export default documentRouter;
