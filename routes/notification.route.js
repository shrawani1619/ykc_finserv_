import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const notificationRouter = Router();

// All routes require authentication
notificationRouter.use(authenticate);

// Get all notifications
notificationRouter.get('/', getNotifications);

// Get unread count
notificationRouter.get('/unread-count', getUnreadCount);

// Mark as read
notificationRouter.put('/:id/read', markAsRead);

// Mark all as read
notificationRouter.put('/read-all', markAllAsRead);

// Delete notification
notificationRouter.delete('/:id', deleteNotification);

export default notificationRouter;
