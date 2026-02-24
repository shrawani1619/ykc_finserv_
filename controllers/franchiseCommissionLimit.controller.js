import FranchiseCommissionLimit from '../models/franchiseCommissionLimit.model.js';
import Bank from '../models/bank.model.js';

/**
 * Get all franchise commission limits
 */
export const getFranchiseCommissionLimits = async (req, res, next) => {
  try {
    const limits = await FranchiseCommissionLimit.find()
      .populate('bank', 'name type')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: limits,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get franchise commission limit by ID
 */
export const getFranchiseCommissionLimitById = async (req, res, next) => {
  try {
    const limit = await FranchiseCommissionLimit.findById(req.params.id)
      .populate('bank', 'name type')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!limit) {
      return res.status(404).json({
        success: false,
        error: 'Franchise commission limit not found',
      });
    }

    res.status(200).json({
      success: true,
      data: limit,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get franchise commission limit by bank ID
 */
export const getFranchiseCommissionLimitByBank = async (req, res, next) => {
  try {
    const limit = await FranchiseCommissionLimit.findOne({ bank: req.params.bankId })
      .populate('bank', 'name type')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.status(200).json({
      success: true,
      data: limit || null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create franchise commission limit
 */
export const createFranchiseCommissionLimit = async (req, res, next) => {
  try {
    const { bankId, limitType, maxCommissionValue } = req.body;

    // Validate required fields
    if (!bankId || !limitType || maxCommissionValue === undefined || maxCommissionValue === null) {
      return res.status(400).json({
        success: false,
        error: 'Bank ID, limit type, and max commission value are required',
      });
    }

    // Validate limit type
    if (!['amount', 'percentage'].includes(limitType)) {
      return res.status(400).json({
        success: false,
        error: 'Limit type must be either "amount" or "percentage"',
      });
    }

    // Validate max commission value
    if (maxCommissionValue < 0) {
      return res.status(400).json({
        success: false,
        error: 'Max commission value must be greater than or equal to 0',
      });
    }

    if (limitType === 'percentage' && maxCommissionValue > 100) {
      return res.status(400).json({
        success: false,
        error: 'Percentage cannot exceed 100',
      });
    }

    // Check if bank exists
    const bank = await Bank.findById(bankId);
    if (!bank) {
      return res.status(404).json({
        success: false,
        error: 'Bank not found',
      });
    }

    // Check if limit already exists for this bank
    const existingLimit = await FranchiseCommissionLimit.findOne({ bank: bankId });
    if (existingLimit) {
      return res.status(400).json({
        success: false,
        error: 'Commission limit already exists for this bank. Please update the existing limit instead.',
      });
    }

    // Create new limit
    const limit = await FranchiseCommissionLimit.create({
      bank: bankId,
      limitType,
      maxCommissionValue,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const populatedLimit = await FranchiseCommissionLimit.findById(limit._id)
      .populate('bank', 'name type')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.status(201).json({
      success: true,
      data: populatedLimit,
      message: 'Franchise commission limit created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update franchise commission limit
 */
export const updateFranchiseCommissionLimit = async (req, res, next) => {
  try {
    const { limitType, maxCommissionValue } = req.body;

    // Validate required fields
    if (!limitType || maxCommissionValue === undefined || maxCommissionValue === null) {
      return res.status(400).json({
        success: false,
        error: 'Limit type and max commission value are required',
      });
    }

    // Validate limit type
    if (!['amount', 'percentage'].includes(limitType)) {
      return res.status(400).json({
        success: false,
        error: 'Limit type must be either "amount" or "percentage"',
      });
    }

    // Validate max commission value
    if (maxCommissionValue < 0) {
      return res.status(400).json({
        success: false,
        error: 'Max commission value must be greater than or equal to 0',
      });
    }

    if (limitType === 'percentage' && maxCommissionValue > 100) {
      return res.status(400).json({
        success: false,
        error: 'Percentage cannot exceed 100',
      });
    }

    // Find existing limit
    const existingLimit = await FranchiseCommissionLimit.findById(req.params.id);
    if (!existingLimit) {
      return res.status(404).json({
        success: false,
        error: 'Franchise commission limit not found',
      });
    }

    // Update limit
    existingLimit.limitType = limitType;
    existingLimit.maxCommissionValue = maxCommissionValue;
    existingLimit.updatedBy = req.user._id;
    const limit = await existingLimit.save();

    const populatedLimit = await FranchiseCommissionLimit.findById(limit._id)
      .populate('bank', 'name type')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.status(200).json({
      success: true,
      data: populatedLimit,
      message: 'Franchise commission limit updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete franchise commission limit
 */
export const deleteFranchiseCommissionLimit = async (req, res, next) => {
  try {
    const limit = await FranchiseCommissionLimit.findById(req.params.id);

    if (!limit) {
      return res.status(404).json({
        success: false,
        error: 'Franchise commission limit not found',
      });
    }

    await FranchiseCommissionLimit.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Franchise commission limit deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

