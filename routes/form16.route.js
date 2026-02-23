import { Router } from 'express';
import {
  createForm16,
  getForm16List,
  getForm16ById,
  updateForm16,
  deleteForm16,
} from '../controllers/form16.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const form16Router = Router();

form16Router.use(authenticate);

form16Router.post('/', requireRole('super_admin', 'accounts_manager', 'agent'), createForm16);
form16Router.get('/', getForm16List);
form16Router.get('/:id', getForm16ById);
form16Router.put('/:id', requireRole('super_admin', 'accounts_manager', 'agent'), updateForm16);
form16Router.delete('/:id', requireRole('super_admin', 'accounts_manager', 'agent'), deleteForm16);

export default form16Router;

