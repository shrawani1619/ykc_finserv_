import User from '../models/user.model.js';

/**
 * Create Agent
 */
export const createAgent = async (req, res, next) => {
  try {
    // Ensure role is set to agent
    const agentData = {
      ...req.body,
      role: 'agent',
    };

    const agent = await User.create(agentData);

    res.status(201).json({
      success: true,
      data: agent,
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
    if (req.user.role === 'franchise_owner') {
      // Franchise owners should only see agents from their franchise
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      query.franchise = req.user.franchiseOwned;
    } else if (req.user.role === 'agent') {
      // Agents can only see themselves
      query._id = req.user._id;
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

    if (req.user.role === 'franchise_owner') {
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
    if (req.user.role === 'franchise_owner') {
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
    if (req.user.role === 'franchise_owner') {
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
    const agent = await User.findOneAndDelete({ _id: req.params.id, role: 'agent' });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
