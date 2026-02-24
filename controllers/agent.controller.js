import User from '../models/user.model.js';
import { getRegionalManagerFranchiseIds, regionalManagerCanAccessFranchise, getRegionalManagerRelationshipManagerIds, regionalManagerCanAccessRelationshipManager } from '../utils/regionalScope.js';

/**
 * Create Agent
 */
export const createAgent = async (req, res, next) => {
  try {
    const agentData = {
      ...req.body,
      role: 'agent',
    };

    // If creating as a franchise owner, assign ownership to that franchise
    if (req.user.role === 'franchise' && req.user.franchiseOwned) {
      agentData.managedBy = agentData.managedBy || req.user.franchiseOwned;
      agentData.managedByModel = agentData.managedByModel || 'Franchise';
    } else if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (!franchiseIds?.length) {
        return res.status(400).json({
          success: false,
          message: 'You have no franchises assigned. Create or get a franchise first.',
        });
      }

      const requestedId = agentData.managedBy?.toString?.() || agentData.managedBy;
      const requestedModel = agentData.managedByModel || 'Franchise';
      if (!requestedId) {
        return res.status(400).json({
          success: false,
          message: `${requestedModel === 'Franchise' ? 'Franchise' : 'Relationship Manager'} is required. Select from the list.`,
        });
      }

      if (requestedModel === 'Franchise') {
        const allowed = franchiseIds.some((id) => id.toString() === requestedId);
        if (!allowed) {
          return res.status(403).json({
            success: false,
            message: 'You can only create agents under franchises assigned to you. Select a franchise from the list.',
          });
        }
      } else if (requestedModel === 'RelationshipManager') {
        // If assigning under a RelationshipManager, ensure that RM is within this regional manager's scope
        const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
        if (RM) {
          const rmDoc = await RM.findById(requestedId).select('regionalManager');
          if (rmDoc && rmDoc.regionalManager && rmDoc.regionalManager.toString() !== req.user._id.toString()) {
            return res.status(403).json({
              success: false,
              message: 'You can only assign agents to relationship managers in your region.',
            });
          }
        }
      }
    }

    const agent = await User.create(agentData);

    const agentWithManagedBy = await User.findById(agent._id)
      .select('-password')
      .populate('managedBy', 'name')
      .populate('franchise', 'name');
    console.log('[Agent Created]', {
      id: agent._id,
      name: agent.name,
      email: agent.email,
      managedById: agent.managedBy,
      managedByName: agentWithManagedBy?.managedBy?.name ?? 'NA',
      createdBy: req.user.role,
    });

    res.status(201).json({
      success: true,
      data: agentWithManagedBy,
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
    if (req.user.role === 'accounts_manager') {
      // Accountant can only see agents under assigned Regional Managers
      const { getAccountantAccessibleAgentIds } = await import('../utils/accountantScope.js');
      const accessibleAgentIds = await getAccountantAccessibleAgentIds(req);
      if (accessibleAgentIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
      query._id = { $in: accessibleAgentIds };
    } else if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      query.managedBy = req.user.franchiseOwned;
      query.managedByModel = 'Franchise';
    } else if (req.user.role === 'agent') {
      query._id = req.user._id;
    } else if (req.user.role === 'relationship_manager') {
      // Relationship managers can only see agents managed by their RelationshipManager profile
      const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
      let rmId = req.user.relationshipManagerOwned;
      if (!rmId && RM) {
        const rmDoc = await RM.findOne({ owner: req.user._id }).select('_id');
        if (rmDoc) rmId = rmDoc._id;
      }
      if (!rmId) {
        // No associated RM profile -> no agents
        return res.status(200).json({ success: true, data: [] });
      }
      query.managedByModel = 'RelationshipManager';
      query.managedBy = rmId;
    } else if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds === null || franchiseIds.length === 0) {
        // no franchises assigned to this regional manager -> still allow agents assigned
        // to relationship managers that belong to this regional manager below
      }

      // Include agents directly under franchises assigned to this regional manager
      // and agents assigned to RelationshipManagers that belong to this regional manager.
      const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
      let rmIds = [];
      if (RM) {
        rmIds = await RM.find({ regionalManager: req.user._id }).distinct('_id');
      }

      const orClauses = [];
      if (franchiseIds && franchiseIds.length) {
        orClauses.push({ managedByModel: 'Franchise', managedBy: { $in: franchiseIds } });
      }
      if (rmIds && rmIds.length) {
        orClauses.push({ managedByModel: 'RelationshipManager', managedBy: { $in: rmIds } });
      }

      // If no clauses, return empty result set
      if (orClauses.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }

      query.$or = orClauses;
    }

    const agents = await User.find(query)
      .select('-password')
      .populate('managedBy', 'name')
      .populate('franchise', 'name');

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
      .populate('managedBy', 'name')
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
      if (agent.managedBy?.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view agents from your franchise.',
        });
      }
    }
    if (req.user.role === 'relationship_manager') {
      // Ensure agent is managed by this relationship manager
      const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
      let rmId = req.user.relationshipManagerOwned;
      if (!rmId && RM) {
        const rmDoc = await RM.findOne({ owner: req.user._id }).select('_id');
        if (rmDoc) rmId = rmDoc._id;
      }
      if (!rmId || agent.managedBy?.toString() !== rmId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view agents associated with you.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      // Check if agent is under a franchise or relationship manager that belongs to this regional manager
      let canAccess = false;
      if (agent.managedByModel === 'Franchise') {
        canAccess = await regionalManagerCanAccessFranchise(req, agent.managedBy);
      } else if (agent.managedByModel === 'RelationshipManager') {
        canAccess = await regionalManagerCanAccessRelationshipManager(req, agent.managedBy);
      }
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view agents from your hierarchy.',
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
      if (existingAgent.managedBy?.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update agents from your franchise.',
        });
      }
    }
    if (req.user.role === 'relationship_manager') {
      // Ensure agent is managed by this relationship manager
      const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
      let rmId = req.user.relationshipManagerOwned;
      if (!rmId && RM) {
        const rmDoc = await RM.findOne({ owner: req.user._id }).select('_id');
        if (rmDoc) rmId = rmDoc._id;
      }
      if (!rmId || existingAgent.managedBy?.toString() !== rmId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update agents associated with you.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      // Check if agent is under a franchise or relationship manager that belongs to this regional manager
      if (existingAgent.managedByModel === 'Franchise') {
        const canAccess = await regionalManagerCanAccessFranchise(req, existingAgent.managedBy);
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only update agents from franchises associated with you.',
          });
        }
      } else if (existingAgent.managedByModel === 'RelationshipManager') {
        const canAccess = await regionalManagerCanAccessRelationshipManager(req, existingAgent.managedBy);
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only update agents from relationship managers associated with you.',
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Agent must be associated with a franchise or relationship manager.',
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
    )
      .select('-password')
      .populate('managedBy', 'name')
      .populate('franchise', 'name');

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
      if (existingAgent.managedBy?.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update agents from your franchise.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      // Check if agent is under a franchise or relationship manager that belongs to this regional manager
      if (existingAgent.managedByModel === 'Franchise') {
        const canAccess = await regionalManagerCanAccessFranchise(req, existingAgent.managedBy);
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only update agents from franchises associated with you.',
          });
        }
      } else if (existingAgent.managedByModel === 'RelationshipManager') {
        const canAccess = await regionalManagerCanAccessRelationshipManager(req, existingAgent.managedBy);
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only update agents from relationship managers associated with you.',
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Agent must be associated with a franchise or relationship manager.',
        });
      }
    }
    if (req.user.role === 'relationship_manager') {
      const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
      let rmId = req.user.relationshipManagerOwned;
      if (!rmId && RM) {
        const rmDoc = await RM.findOne({ owner: req.user._id }).select('_id');
        if (rmDoc) rmId = rmDoc._id;
      }
      if (!rmId || existingAgent.managedBy?.toString() !== rmId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update agents associated with you.',
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
      // Check if agent is under a franchise or relationship manager that belongs to this regional manager
      if (agent.managedByModel === 'Franchise') {
        const canAccess = await regionalManagerCanAccessFranchise(req, agent.managedBy);
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only delete agents from franchises associated with you.',
          });
        }
      } else if (agent.managedByModel === 'RelationshipManager') {
        const canAccess = await regionalManagerCanAccessRelationshipManager(req, agent.managedBy);
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only delete agents from relationship managers associated with you.',
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Agent must be associated with a franchise or relationship manager.',
        });
      }
    }
    if (req.user.role === 'relationship_manager') {
      const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
      let rmId = req.user.relationshipManagerOwned;
      if (!rmId && RM) {
        const rmDoc = await RM.findOne({ owner: req.user._id }).select('_id');
        if (rmDoc) rmId = rmDoc._id;
      }
      if (!rmId || agent.managedBy?.toString() !== rmId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete agents associated with you.',
        });
      }
    }
    
    // Log deletion to audit log
    const agentData = agent.toObject();
    const auditService = (await import('../services/audit.service.js')).default;
    await auditService.logDelete(req.user._id, 'User', req.params.id, agentData, req);
    
    await User.findOneAndDelete({ _id: req.params.id, role: 'agent' });

    res.status(200).json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Sub-Agent (for agents)
 */
export const createSubAgent = async (req, res, next) => {
  try {
    // Only agents can create sub-agents
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        error: 'Only agents can create sub-agents',
      });
    }

    const subAgentData = {
      ...req.body,
      role: 'agent',
      parentAgent: req.user._id, // Set parent agent to current logged-in agent
      // Inherit managedBy from parent agent
      managedBy: req.user.managedBy,
      managedByModel: req.user.managedByModel,
    };

    const subAgent = await User.create(subAgentData);

    const subAgentWithParent = await User.findById(subAgent._id)
      .select('-password')
      .populate('parentAgent', 'name email')
      .populate('managedBy', 'name');

    res.status(201).json({
      success: true,
      data: subAgentWithParent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Sub-Agents (for current agent)
 */
export const getSubAgents = async (req, res, next) => {
  try {
    // Only agents can view their sub-agents
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        error: 'Only agents can view sub-agents',
      });
    }

    // Agents can only see their own sub-agents
    const subAgents = await User.find({ parentAgent: req.user._id, role: 'agent' })
      .select('-password')
      .populate('parentAgent', 'name email')
      .populate('managedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: subAgents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Sub-Agent By ID
 */
export const getSubAgentById = async (req, res, next) => {
  try {
    // Only agents can view their sub-agents
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        error: 'Only agents can view sub-agents',
      });
    }

    // Agents can only view their own sub-agents
    const subAgent = await User.findOne({ 
      _id: req.params.id, 
      parentAgent: req.user._id, 
      role: 'agent' 
    })
      .select('-password')
      .populate('parentAgent', 'name email')
      .populate('managedBy', 'name');

    if (!subAgent) {
      return res.status(404).json({
        success: false,
        error: 'Sub-agent not found',
      });
    }

    res.status(200).json({
      success: true,
      data: subAgent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Sub-Agent
 */
export const updateSubAgent = async (req, res, next) => {
  try {
    // Only agents can update their sub-agents
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        error: 'Only agents can update sub-agents',
      });
    }

    // Agents can only update their own sub-agents
    const existingSubAgent = await User.findOne({ 
      _id: req.params.id, 
      parentAgent: req.user._id, 
      role: 'agent' 
    });

    if (!existingSubAgent) {
      return res.status(404).json({
        success: false,
        error: 'Sub-agent not found',
      });
    }

    // Prevent changing parentAgent or role
    const updateData = { ...req.body };
    delete updateData.parentAgent;
    delete updateData.role;
    delete updateData.managedBy;
    delete updateData.managedByModel;

    // Agents can only update their own sub-agents
    const subAgent = await User.findOneAndUpdate(
      { _id: req.params.id, parentAgent: req.user._id, role: 'agent' },
      updateData,
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('parentAgent', 'name email')
      .populate('managedBy', 'name');

    res.status(200).json({
      success: true,
      data: subAgent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Sub-Agent
 */
export const deleteSubAgent = async (req, res, next) => {
  try {
    // Only agents can delete their sub-agents
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        error: 'Only agents can delete sub-agents',
      });
    }

    // Agents can only delete their own sub-agents
    const subAgent = await User.findOne({ 
      _id: req.params.id, 
      parentAgent: req.user._id, 
      role: 'agent' 
    });

    if (!subAgent) {
      return res.status(404).json({
        success: false,
        error: 'Sub-agent not found',
      });
    }

    // Delete the sub-agent
    await User.findOneAndDelete({ 
      _id: req.params.id, 
      parentAgent: req.user._id, 
      role: 'agent' 
    });

    res.status(200).json({
      success: true,
      message: 'Sub-agent deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
