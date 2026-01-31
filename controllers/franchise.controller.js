import Franchise from '../models/franchise.model.js';
import User from '../models/user.model.js';
import Lead from '../models/lead.model.js';
import Invoice from '../models/invoice.model.js';
import Payout from '../models/payout.model.js';
import mongoose from 'mongoose';
import { getPaginationMeta } from '../utils/helpers.js';

/**
 * Create Franchise
 */
export const createFranchise = async (req, res, next) => {
  try {
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        message: 'Franchise name is required',
      });
    }

    // Create franchise in database
    const franchise = await Franchise.create(req.body);

    // Fetch the created franchise with populated fields
    const populatedFranchise = await Franchise.findById(franchise._id)
      .populate('owner', 'name email');

    console.log('✅ Franchise created successfully:', {
      id: franchise._id,
      name: franchise.name,
      status: franchise.status,
    });

    res.status(201).json({
      success: true,
      message: 'Franchise created successfully and saved to database',
      data: populatedFranchise,
    });
  } catch (error) {
    console.error('❌ Error creating franchise:', error);
    next(error);
  }
};

/**
 * Get All Franchises
 */
export const getFranchises = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;

    const franchises = await Franchise.find(query)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Franchise.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: franchises,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Active Franchises (Public - for signup)
 */
export const getActiveFranchises = async (req, res, next) => {
  try {
    const franchises = await Franchise.find({ status: 'active' })
      .select('name _id')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: franchises,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Franchise By ID
 */
export const getFranchiseById = async (req, res, next) => {
  try {
    const franchise = await Franchise.findById(req.params.id)
      .populate('owner', 'name email');

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found',
      });
    }

    res.status(200).json({
      success: true,
      data: franchise,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Franchise
 */
export const updateFranchise = async (req, res, next) => {
  try {
    const franchise = await Franchise.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('owner', 'name email');

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Franchise updated successfully',
      data: franchise,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Franchise Status
 */
export const updateFranchiseStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const franchise = await Franchise.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('owner', 'name email');

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Franchise status updated',
      data: franchise,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get franchise agents
 */
export const getFranchiseAgents = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      franchise: req.params.id,
      role: 'agent',
    };
    if (status) query.status = status;

    const agents = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: agents,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get franchise performance metrics
 */
export const getFranchisePerformance = async (req, res, next) => {
  try {
    const franchiseId = new mongoose.Types.ObjectId(req.params.id);

    // Get total agents
    const totalAgents = await User.countDocuments({
      franchise: franchiseId,
      role: 'agent',
      status: 'active',
    });

    // Get total leads
    const totalLeads = await Lead.countDocuments({ franchise: franchiseId });

    // Get disbursed amount
    const disbursedAggregation = await Lead.aggregate([
      { $match: { franchise: franchiseId } },
      { $group: { _id: null, total: { $sum: '$disbursedAmount' } } },
    ]);
    const totalDisbursed = disbursedAggregation[0]?.total || 0;

    // Get total commission
    const commissionAggregation = await Invoice.aggregate([
      { $match: { franchise: franchiseId } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const totalCommission = commissionAggregation[0]?.total || 0;

    // Update franchise performance metrics
    const franchise = await Franchise.findById(franchiseId);
    if (franchise) {
      franchise.performanceMetrics = {
        totalLeads,
        activeAgents: totalAgents,
        totalCommission,
        lastUpdated: new Date(),
      };
      await franchise.save();
    }

    res.status(200).json({
      success: true,
      data: {
        totalAgents,
        totalLeads,
        totalDisbursed,
        totalCommission,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Franchise
 */
export const deleteFranchise = async (req, res, next) => {
  try {
    const franchise = await Franchise.findByIdAndDelete(req.params.id);

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Franchise deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
