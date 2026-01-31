import commissionService from '../services/commission.service.js';
import CommissionRule from '../models/commissionRule.model.js';
import { getPaginationMeta } from '../utils/helpers.js';

/**
 * Get all commission rules
 */
export const getCommissionRules = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, bankId, loanType, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (bankId) query.bank = bankId;
    if (loanType) query.loanType = loanType;
    if (status) query.status = status;

    const rules = await CommissionRule.find(query)
      .populate('bank', 'name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CommissionRule.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: rules,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create commission rule
 */
export const createCommissionRule = async (req, res, next) => {
  try {
    const rule = await CommissionRule.create({
      ...req.body,
      createdBy: req.user._id,
    });

    const populatedRule = await CommissionRule.findById(rule._id).populate('bank', 'name type');

    res.status(201).json({
      success: true,
      message: 'Commission rule created successfully',
      data: populatedRule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update commission rule
 */
export const updateCommissionRule = async (req, res, next) => {
  try {
    const rule = await CommissionRule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('bank', 'name type');

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Commission rule not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Commission rule updated successfully',
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate commission for a lead
 */
export const calculateCommission = async (req, res, next) => {
  try {
    const result = await commissionService.calculateCommission(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Commission calculated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
