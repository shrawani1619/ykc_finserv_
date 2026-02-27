import { Router } from 'express';
import {
  createBanner,
  getBanners,
  getBannerById,
  updateBanner,
  updateBannerStatus,
  deleteBanner,
} from '../controllers/banner.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const bannerRouter = Router();

// Public read-only access for banners (anyone can view)
bannerRouter.get('/', getBanners);
bannerRouter.get('/:id', getBannerById);

// Authenticated + role-restricted routes for managing banners
bannerRouter.use(authenticate);

bannerRouter.post('/', requireRole('super_admin'), createBanner);
bannerRouter.put('/:id', requireRole('super_admin'), updateBanner);
bannerRouter.delete('/:id', requireRole('super_admin'), deleteBanner);
bannerRouter.put('/:id/status', requireRole('super_admin'), updateBannerStatus);

export default bannerRouter;

