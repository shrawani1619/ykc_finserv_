import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  transferAgent,
  activateUser,
} from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const userRouter = Router();

// All routes require authentication
userRouter.use(authenticate);

// Get all users
userRouter.get('/', getUsers);

// Get user by ID
userRouter.get('/:id', getUserById);

// Create user (Admin/Manager)
userRouter.post('/', requireRole('super_admin', 'regional_manager'), createUser);

// Update user
userRouter.put('/:id', updateUser);

// Transfer agent between franchises (Admin/Manager)
userRouter.put('/:id/transfer', requireRole('super_admin', 'regional_manager'), transferAgent);

// Activate/deactivate user (Admin/Manager)
userRouter.post('/:id/activate', requireRole('super_admin', 'regional_manager'), activateUser);

export default userRouter;
