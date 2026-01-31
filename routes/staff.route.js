import { Router } from 'express';
import { createStaff, getStaff, getStaffById, updateStaff, updateStaffStatus, deleteStaff } from '../controllers/staff.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const staffRouter = Router();

staffRouter.post('/', authenticate, requireRole('super_admin', 'relationship_manager'), createStaff);
staffRouter.get('/', authenticate, getStaff);
staffRouter.get('/:id', authenticate, requireRole('super_admin', 'relationship_manager'), getStaffById);
staffRouter.put('/:id', authenticate, requireRole('super_admin', 'relationship_manager'), updateStaff);
staffRouter.delete('/:id', authenticate, requireRole('super_admin', 'relationship_manager'), deleteStaff);
staffRouter.put('/:id/status', authenticate, requireRole('super_admin', 'relationship_manager'), updateStaffStatus);


export default staffRouter;
