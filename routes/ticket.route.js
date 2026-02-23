import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import fileUploadService from '../services/fileUpload.service.js';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  resolveTicket,
  getTicketCategories,
} from '../controllers/ticket.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/categories', getTicketCategories);
router.post('/', fileUploadService.getUploadMiddleware('attachment'), createTicket);
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.put('/:id', updateTicket);
router.post('/:id/resolve', resolveTicket);

export default router;

