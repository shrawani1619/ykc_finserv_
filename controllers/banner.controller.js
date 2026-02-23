import Banner from '../models/banner.model.js';

/**
 * Create Banner
 */
export const createBanner = async (req, res, next) => {
  try {
    const { name, attachment, fileName, fileSize, mimeType } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Banner name is required',
      });
    }

    if (!attachment) {
      return res.status(400).json({
        success: false,
        error: 'Banner attachment is required',
      });
    }

    const banner = await Banner.create({
      name: name.trim(),
      attachment,
      fileName,
      fileSize,
      mimeType,
      status: req.body.status || 'active',
      metadata: req.body.metadata || {},
    });

    res.status(201).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Banners
 */
export const getBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Banner By ID
 */
export const getBannerById = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found',
      });
    }

    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Banner
 */
export const updateBanner = async (req, res, next) => {
  try {
    const { name, attachment, fileName, fileSize, mimeType, status } = req.body;

    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found',
      });
    }

    // Update fields
    if (name !== undefined) banner.name = name.trim();
    if (attachment !== undefined) banner.attachment = attachment;
    if (fileName !== undefined) banner.fileName = fileName;
    if (fileSize !== undefined) banner.fileSize = fileSize;
    if (mimeType !== undefined) banner.mimeType = mimeType;
    if (status !== undefined) banner.status = status;
    if (req.body.metadata !== undefined) banner.metadata = req.body.metadata;

    await banner.save();

    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Banner
 */
export const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found',
      });
    }

    await Banner.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Banner Status
 */
export const updateBannerStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required (active or inactive)',
      });
    }

    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found',
      });
    }

    banner.status = status;
    await banner.save();

    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

