import User from '../models/user.model.js';
import Franchise from '../models/franchise.model.js';
import { getPaginationMeta } from '../utils/helpers.js';
import auditService from '../services/audit.service.js';

/**
 * Get all users (role-based filtering)
 */
export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, status, franchiseId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};

    // Role-based filtering
    if (req.user.role === 'franchise_owner') {
      query.franchise = req.user.franchise;
      query.role = 'agent'; // Franchise owners can only see their agents
    } else if (req.user.role === 'franchise_manager') {
      // Can see all agents and franchise owners
      query.$or = [{ role: 'agent' }, { role: 'franchise_owner' }];
    }

    if (role) query.role = role;
    if (status) query.status = status;
    if (franchiseId) query.franchise = franchiseId;

    const users = await User.find(query)
      .select('-password')
      .populate('franchise', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: users,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('franchise', 'name');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create user (Admin/Manager)
 */
export const createUser = async (req, res, next) => {
  try {
    const { role, franchise, ...userData } = req.body;

    // Validate role
    const validRoles = ['super_admin', 'relationship_manager', 'franchise_manager', 'franchise_owner', 'agent', 'accounts_manager'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    // Set franchise for agents and franchise owners
    if (['agent', 'franchise_owner'].includes(role)) {
      if (!franchise) {
        return res.status(400).json({
          success: false,
          message: 'Franchise is required for this role',
        });
      }
      userData.franchise = franchise;
    }

    userData.role = role;
    userData.createdBy = req.user._id;

    const user = await User.create(userData);

    // Log audit
    await auditService.logCreate(req.user._id, 'user', user._id, user.toObject(), req);

    const userResponse = await User.findById(user._id).select('-password').populate('franchise', 'name');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user
 */
export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const previousValues = user.toObject();
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-password').populate('franchise', 'name');

    // Log audit
    await auditService.logUpdate(req.user._id, 'user', updatedUser._id, previousValues, updatedUser.toObject(), req);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer agent between franchises
 */
export const transferAgent = async (req, res, next) => {
  try {
    const { franchiseId } = req.body;

    if (!franchiseId) {
      return res.status(400).json({
        success: false,
        message: 'Franchise ID is required',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'Only agents can be transferred',
      });
    }

    // Verify franchise exists
    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found',
      });
    }

    const previousValues = user.toObject();
    user.franchise = franchiseId;
    await user.save();

    // Log audit
    await auditService.logUpdate(req.user._id, 'user', user._id, previousValues, user.toObject(), req);

    const updatedUser = await User.findById(user._id).select('-password').populate('franchise', 'name');

    res.status(200).json({
      success: true,
      message: 'Agent transferred successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate/Deactivate user
 */
export const activateUser = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'blocked'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const previousValues = user.toObject();
    user.status = status;
    await user.save();

    // Log audit
    await auditService.logUpdate(req.user._id, 'user', user._id, previousValues, user.toObject(), req);

    const updatedUser = await User.findById(user._id).select('-password');

    res.status(200).json({
      success: true,
      message: `User ${status} successfully`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
