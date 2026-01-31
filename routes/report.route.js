import { Router } from 'express';
import {
  generateLeadsReport,
  generateCommissionsReport,
  generatePayoutsReport,
  generateTDSReport,
} from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const reportRouter = Router();

// All routes require authentication
reportRouter.use(authenticate);

// Generate reports
reportRouter.get('/leads', generateLeadsReport);
reportRouter.get('/commissions', generateCommissionsReport);
reportRouter.get('/payouts', generatePayoutsReport);
reportRouter.get('/tds', generateTDSReport);

export default reportRouter;
