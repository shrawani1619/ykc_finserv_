import Staff from '../models/staff.model.js';

/**
 * Create Staff
 */
export const createStaff = async (req, res, next) => {
  try {
    const staff = await Staff.create(req.body);

    // Exclude password from response
    const staffResponse = await Staff.findById(staff._id).select('-password');

    res.status(201).json({
      success: true,
      data: staffResponse,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Staff
 */
export const getStaff = async (req, res, next) => {
  try {
    const staff = await Staff.find().select('-password').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Staff By ID
 */
export const getStaffById = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id).select('-password');

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff not found',
      });
    }

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Staff
 */
export const updateStaff = async (req, res, next) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff not found',
      });
    }

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Staff Status
 */
export const updateStaffStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Staff status updated',
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Staff
 */
export const deleteStaff = async (req, res, next) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Staff deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
