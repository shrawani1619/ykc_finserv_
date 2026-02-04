import User from '../models/user.model.js';
import { getRegionalManagerFranchiseIds, regionalManagerCanAccessFranchise } from '../utils/regionalScope.js';

/**
 * Create Agent
 */
export const createAgent = async (req, res, next) => {
  try {
    const agentData = {
      ...req.body,
      role: 'agent',
    };

    if (req.user.role === 'franchise' && req.user.franchiseOwned) {
      agentData.franchise = agentData.franchise || req.user.franchiseOwned;
    }

    const agent = await User.create(agentData);

    const agentWithFranchise = await User.findById(agent._id).select('-password').populate('franchise', 'name');
    console.log('[Agent Created]', {
      id: agent._id,
      name: agent.name,
      email: agent.email,
      franchiseId: agent.franchise,
      franchiseName: agentWithFranchise?.franchise?.name ?? 'NA',
      createdBy: req.user.role,
    });

    res.status(201).json({
      success: true,
      data: agentWithFranchise,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Agents
 */
export const getAgents = async (req, res, next) => {
  try {
    const query = { role: 'agent' };

    // Role-based filtering
    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      query.franchise = req.user.franchiseOwned;
    } else if (req.user.role === 'agent') {
      query._id = req.user._id;
    } else if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds === null || franchiseIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
      query.franchise = { $in: franchiseIds };
    }

    const agents = await User.find(query).select('-password').populate('franchise', 'name');

    res.status(200).json({
      success: true,
      data: agents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Agent By ID
 */
export const getAgentById = async (req, res, next) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' })
      .select('-password')
      .populate('franchise', 'name');

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    // Role-based access control
    if (req.user.role === 'agent' && agent._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own profile.',
      });
    }

    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      if (agent.franchise?.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view agents from your franchise.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = await regionalManagerCanAccessFranchise(req, agent.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view agents from franchises associated with you.',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Agent
 */
export const updateAgent = async (req, res, next) => {
  try {
    // Check access before updating
    const existingAgent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!existingAgent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    // Role-based access control
    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      if (existingAgent.franchise?.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update agents from your franchise.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = await regionalManagerCanAccessFranchise(req, existingAgent.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update agents from franchises associated with you.',
        });
      }
    }

    const agent = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'agent' },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).select('-password').populate('franchise', 'name');

    res.status(200).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Agent Status
 */
export const updateAgentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Check access before updating
    const existingAgent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!existingAgent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    // Role-based access control
    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      if (existingAgent.franchise?.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update agents from your franchise.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = await regionalManagerCanAccessFranchise(req, existingAgent.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update agents from franchises associated with you.',
        });
      }
    }

    const agent = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'agent' },
      { status },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Agent status updated',
      data: agent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Agent
 */
export const deleteAgent = async (req, res, next) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found',
      });
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = await regionalManagerCanAccessFranchise(req, agent.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete agents from franchises associated with you.',
        });
      }
    }
    await User.findOneAndDelete({ _id: req.params.id, role: 'agent' });

    res.status(200).json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
