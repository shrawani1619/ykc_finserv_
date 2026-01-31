import { Router } from 'express';
import { login, signup, logout, getMe, changePassword, updateProfile } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const authRouter = Router();

// Public routes
authRouter.post('/login', login);
authRouter.post('/signup', signup);
authRouter.post('/register', signup); // Alias for signup

// Protected routes
authRouter.post('/logout', authenticate, logout);
authRouter.get('/me', authenticate, getMe);
authRouter.put('/profile', authenticate, updateProfile);
authRouter.post('/change-password', authenticate, changePassword);

export default authRouter;
