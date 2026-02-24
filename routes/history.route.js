import express from 'express';
import { getAllHistory, getHistoryStats } from '../controllers/history.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const historyRouter = express.Router();

// All routes require authentication and super_admin or accounts_manager role
historyRouter.use(authenticate);
historyRouter.use(requireRole('super_admin', 'accounts_manager'));

// Get all history with filters
historyRouter.get('/', getAllHistory);

// Get history statistics
historyRouter.get('/stats', getHistoryStats);

export default historyRouter;

