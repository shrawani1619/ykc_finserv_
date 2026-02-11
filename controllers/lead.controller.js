import mongoose from 'mongoose';
import Lead from '../models/lead.model.js';
import LeadHistory from '../models/leadHistory.model.js';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import BankManager from '../models/bankManager.model.js';
import commissionService from '../services/commission.service.js';
import invoiceService from '../services/invoice.service.js';
import emailService from '../services/email.service.js';
import { getPaginationMeta, trackLeadChanges } from '../utils/helpers.js';
import { getRegionalManagerFranchiseIds, regionalManagerCanAccessFranchise } from '../utils/regionalScope.js';

/**
 * Create Lead
 */
export const createLead = async (req, res, next) => {
  try {
    // Generate case number

    let agentId = req.body.agent;
    let associated = req.body.associated;
    let associatedModel = req.body.associatedModel;

    // Normalize empty strings
    if (associated === '') associated = undefined;
    if (associatedModel === '') associatedModel = undefined;

    // Agent users always create leads for themselves; infer associated from their managedBy
    if (req.user.role === 'agent') {
      agentId = req.user._id;
      associated = req.user.managedBy || req.user.franchise || undefined;
      associatedModel = req.user.managedByModel || (req.user.franchise ? 'Franchise' : undefined);
    }

    // Franchise owners create leads for their franchise
    if (req.user.role === 'franchise') {
      associated = req.user.franchiseOwned || req.user.franchise || associated;
      associatedModel = 'Franchise';
    }

    // Relationship managers create leads for themselves
    if (req.user.role === 'relationship_manager') {
      associated = req.user.relationshipManagerOwned || associated;
      associatedModel = 'RelationshipManager';
    }

    // Regional manager: if associatedModel === 'Franchise' enforce regional scope
    if (req.user.role === 'regional_manager' && associatedModel === 'Franchise' && associated) {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds !== null && franchiseIds.length > 0) {
        const allowed = franchiseIds.some((fid) => fid.toString() === associated.toString());
        if (!allowed) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only create leads for franchises associated with you.',
          });
        }
      }
    }

    // If associated not provided, try to infer it from the agent (useful when RM creates lead for an agent)
    if (!associated && agentId) {
      try {
        const agentUser = await User.findById(agentId).select('managedBy managedByModel');
        if (agentUser && agentUser.managedBy) {
          associated = agentUser.managedBy;
          associatedModel = agentUser.managedByModel;
        }
      } catch (err) {
        console.warn('Unable to infer associated from agent:', err);
      }
    }

    const leadData = {
      ...req.body,
      agent: agentId,
      associated,
      associatedModel,
    };

    // Validate agent and associated ID formats
    if (leadData.agent && !mongoose.Types.ObjectId.isValid(leadData.agent)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format',
      });
    }
    if (leadData.associated && !mongoose.Types.ObjectId.isValid(leadData.associated)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid associated ID format',
      });
    }

    console.log('🔍 DEBUG: Creating lead with agent:', leadData.agent);

    // Ensure SM/BM exists (prefer BankManager for bank contacts; fallback to Staff)
    try {
      if (!leadData.smBm && (leadData.smBmEmail || leadData.smBmMobile || req.body.smBmName)) {
        let existing = null;

        // If bank provided, prefer BankManager collection (they don't need login)
        if (leadData.bank) {
          if (leadData.smBmEmail) {
            existing = await BankManager.findOne({ email: leadData.smBmEmail.toLowerCase(), bank: leadData.bank });
          }
          if (!existing && leadData.smBmMobile) {
            existing = await BankManager.findOne({ mobile: leadData.smBmMobile, bank: leadData.bank });
          }

          if (existing) {
            leadData.smBm = existing._id;
            leadData.smBmModel = 'BankManager';
          } else {
            // Create new BankManager for contact purposes
            const name = req.body.smBmName || (leadData.smBmEmail ? leadData.smBmEmail.split('@')[0].replace(/\./g, ' ') : 'SM/BM');
            const newBM = await BankManager.create({
              name,
              email: leadData.smBmEmail ? leadData.smBmEmail.toLowerCase() : undefined,
              mobile: leadData.smBmMobile || undefined,
              role: 'bm',
              bank: leadData.bank,
              status: 'active',
            });
            leadData.smBm = newBM._id;
            leadData.smBmModel = 'BankManager';
          }
        } else {
          // No bank specified -> fallback to creating Staff (login-able)
          if (leadData.smBmEmail) {
            existing = await Staff.findOne({ email: leadData.smBmEmail.toLowerCase() });
          }
          if (!existing && leadData.smBmMobile) {
            existing = await Staff.findOne({ mobile: leadData.smBmMobile });
          }

          if (existing) {
            leadData.smBm = existing._id;
            leadData.smBmModel = 'Staff';
          } else {
            const name = req.body.smBmName || (leadData.smBmEmail ? leadData.smBmEmail.split('@')[0].replace(/\./g, ' ') : 'SM/BM');
            const newStaff = await Staff.create({
              name,
              email: leadData.smBmEmail ? leadData.smBmEmail.toLowerCase() : undefined,
              mobile: leadData.smBmMobile || undefined,
              password: 'Default@123',
              role: 'staff',
              status: 'active',
            });
            leadData.smBm = newStaff._id;
            leadData.smBmModel = 'Staff';
          }
        }
      }
    } catch (err) {
      console.warn('Unable to ensure SM/BM exists:', err);
    }

    // Ensure ASM exists as a BankManager (contact) when bank provided and ASM details present
    try {
      if (leadData.bank && (leadData.asmEmail || leadData.asmMobile || req.body.asmName)) {
        let existingAsm = null;
        if (leadData.asmEmail) {
          existingAsm = await BankManager.findOne({ email: leadData.asmEmail.toLowerCase(), bank: leadData.bank });
        }
        if (!existingAsm && leadData.asmMobile) {
          existingAsm = await BankManager.findOne({ mobile: leadData.asmMobile, bank: leadData.bank });
        }
        if (!existingAsm) {
          const asmName = req.body.asmName || (leadData.asmEmail ? leadData.asmEmail.split('@')[0].replace(/\./g, ' ') : 'ASM');
          await BankManager.create({
            name: asmName,
            email: leadData.asmEmail ? leadData.asmEmail.toLowerCase() : undefined,
            mobile: leadData.asmMobile || undefined,
            role: 'asm',
            bank: leadData.bank,
            status: 'active',
          });
        }
      }
    } catch (err) {
      console.warn('Unable to ensure ASM BankManager exists:', err);
    }

    const lead = await Lead.create(leadData);

    const populatedLead = await Lead.findById(lead._id)
      .populate('agent', 'name email mobile')
      .populate('associated', 'name')
      .populate('bank', 'name type')
      .populate('smBm', 'name email mobile');

    // Track creation
    await LeadHistory.create({
      lead: lead._id,
      changedBy: req.user._id,
      action: 'created',
      changes: [],
      remarks: 'Lead created',
    });

    res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: populatedLead,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Leads
 */
export const getLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, verificationStatus, agentId, associatedId, associatedModel, franchiseId, bankId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};

    // Role-based filtering: agent = own leads, franchise = own + agents' leads, super_admin = all, regional_manager = their franchises
    if (req.user.role === 'agent') {
      query.agent = req.user._id;
    } else if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      // Franchise owners can only see leads for agents under their franchise (and leads where they are the agent)
      const agentIds = await User.find({ managedByModel: 'Franchise', managedBy: req.user.franchiseOwned }).distinct('_id');
      const allowedAgentIds = (agentIds || []).map(String);
      allowedAgentIds.push(req.user._id.toString());
      if (!allowedAgentIds.length) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      query.agent = { $in: allowedAgentIds };
    } else if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds === null || franchiseIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      // regional managers only manage franchises; restrict to leads associated with franchises in their scope
      query.associated = { $in: franchiseIds };
      query.associatedModel = 'Franchise';
    } else if (req.user.role === 'relationship_manager') {
      // Relationship managers should only see leads for agents associated with their RM profile
      const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
      let rmId = req.user.relationshipManagerOwned;
      if (!rmId && RM) {
        const rmDoc = await RM.findOne({ owner: req.user._id }).select('_id');
        if (rmDoc) rmId = rmDoc._id;
      }
      if (!rmId) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      // find agents managed by this RM
      const agentIds = await User.find({ managedByModel: 'RelationshipManager', managedBy: rmId }).distinct('_id');
      const allowedAgentIds = agentIds || [];
      // include leads where agent is the relationship manager user (if any)
      allowedAgentIds.push(req.user._id);
      query.agent = { $in: allowedAgentIds };
    }
    // super_admin: no base filter → all leads; optional filters below

    if (status) query.status = status;
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (bankId) query.bank = bankId;
    const canFilterScope = ['super_admin', 'relationship_manager'].includes(req.user.role);
    if (canFilterScope) {
      if (agentId) {
        // If relationship_manager, ensure requested agentId is within RM's scope
        if (req.user.role === 'relationship_manager') {
          const RM = await import('../models/relationship.model.js').then(m => m.default).catch(() => null);
          let rmId = req.user.relationshipManagerOwned;
          if (!rmId && RM) {
            const rmDoc = await RM.findOne({ owner: req.user._id }).select('_id');
            if (rmDoc) rmId = rmDoc._id;
          }
          const allowed = await User.exists({ _id: agentId, managedByModel: 'RelationshipManager', managedBy: rmId });
          if (!allowed) {
            return res.status(403).json({ success: false, error: 'Access denied.' });
          }
        }
        query.agent = agentId;
      }
      // Support new associatedId/associatedModel query params; fall back to legacy franchiseId if present
      if (associatedId) {
        query.associated = associatedId;
        if (associatedModel) query.associatedModel = associatedModel;
      } else if (franchiseId) {
        query.associated = franchiseId;
        query.associatedModel = 'Franchise';
      }
    }

    const leads = await Lead.find(query)
      .populate('agent', 'name email mobile')
      .populate('associated', 'name')
      .populate('bank', 'name type')
      .populate('verifiedBy', 'name email')
      .populate('smBm', 'name email mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Lead.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: leads,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Lead By ID
 */
export const getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('agent', 'name email mobile')
      .populate('associated', 'name')
      .populate('bank', 'name type')
      .populate('verifiedBy', 'name email')
      .populate('smBm', 'name email mobile');

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    // Role-based access control
    if (req.user.role === 'agent' && lead.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own leads.',
      });
    }

    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      // Franchise owners can view leads for agents under their franchise (and leads where they are the agent)
      const agentIds = await User.find({ managedByModel: 'Franchise', managedBy: req.user.franchiseOwned }).distinct('_id');
      const allowedAgentIds = (agentIds || []).map(String);
      allowedAgentIds.push(req.user._id.toString());
      if (!allowedAgentIds.includes(lead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view leads associated with your franchise agents.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = lead.associatedModel === 'Franchise'
        ? await regionalManagerCanAccessFranchise(req, lead.associated)
        : true;
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view leads from franchises associated with you.',
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
      // Get agents for this RM
      const agentIds = rmId ? await User.find({ managedByModel: 'RelationshipManager', managedBy: rmId }).distinct('_id') : [];
      const allowedAgentIds = agentIds || [];
      allowedAgentIds.push(req.user._id);
      if (!allowedAgentIds.map(String).includes(lead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view leads associated with your agents.',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Lead
 */
export const updateLead = async (req, res, next) => {
  try {
    console.log('🔍 DEBUG: Update lead request:', {
      leadId: req.params.id,
      body: req.body,
      agent: req.body.agent,
      agentType: typeof req.body.agent
    });

    // Check access before updating
    const existingLead = await Lead.findById(req.params.id);
    if (!existingLead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    // Role-based access control
    if (req.user.role === 'agent' && existingLead.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only update your own leads.',
      });
    }

    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      // Franchise owners can update leads for agents under their franchise (and leads where they are the agent)
      const agentIds = await User.find({ managedByModel: 'Franchise', managedBy: req.user.franchiseOwned }).distinct('_id');
      const allowedAgentIds = (agentIds || []).map(String);
      allowedAgentIds.push(req.user._id.toString());
      if (!allowedAgentIds.includes(existingLead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update leads associated with your franchise agents.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = existingLead.associatedModel === 'Franchise'
        ? await regionalManagerCanAccessFranchise(req, existingLead.associated)
        : true;
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update leads from franchises associated with you.',
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
      const agentIds = rmId ? await User.find({ managedByModel: 'RelationshipManager', managedBy: rmId }).distinct('_id') : [];
      const allowedAgentIds = agentIds || [];
      allowedAgentIds.push(req.user._id);
      if (!allowedAgentIds.map(String).includes(existingLead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update leads associated with your agents.',
        });
      }
    }

    // Ensure agent ID is valid ObjectId format
    const updateData = { ...req.body };
    if (updateData.dsaCode !== undefined) {
      updateData.codeUse = updateData.dsaCode;
      delete updateData.dsaCode;
    }
    if (updateData.agent && !mongoose.Types.ObjectId.isValid(updateData.agent)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format',
      });
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('agent', 'name email mobile')
      .populate('associated', 'name')
      .populate('bank', 'name type')
      .populate('verifiedBy', 'name email')
      .populate('smBm', 'name email mobile');

    // Track changes - only check fields that were actually updated
    const fieldsToCheck = Object.keys(updateData);
    const changes = trackLeadChanges(existingLead.toObject(), lead.toObject(), fieldsToCheck);
    if (changes.length > 0) {
      await LeadHistory.create({
        lead: lead._id,
        changedBy: req.user._id,
        action: 'updated',
        changes,
        remarks: req.body.remarks || null,
      });
    }

    console.log('🔍 DEBUG: Updated lead:', {
      leadId: lead._id,
      agent: lead.agent,
      agentId: lead.agent?._id || lead.agent,
      agentName: lead.agent?.name,
      agentPopulated: !!lead.agent?.name
    });

    res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error('🔍 DEBUG: Update lead error:', error);
    next(error);
  }
};

/**
 * Update Lead Status
 */
export const updateLeadStatus = async (req, res, next) => {
  try {
    const { status, sanctionedDate, disbursedAmount, disbursementType } = req.body;

    // Check access before updating
    const existingLead = await Lead.findById(req.params.id);
    if (!existingLead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    // Role-based access control - agents cannot update lead status
    if (req.user.role === 'agent') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Agents can only view leads, not update their status.',
      });
    }

    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      // Franchise owners can update leads for agents under their franchise (and leads where they are the agent)
      const agentIds = await User.find({ managedByModel: 'Franchise', managedBy: req.user.franchiseOwned }).distinct('_id');
      const allowedAgentIds = (agentIds || []).map(String);
      allowedAgentIds.push(req.user._id.toString());
      if (!allowedAgentIds.includes(existingLead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update leads associated with your franchise agents.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = await regionalManagerCanAccessFranchise(req, existingLead.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update leads from franchises associated with you.',
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
      const agentIds = rmId ? await User.find({ managedByModel: 'RelationshipManager', managedBy: rmId }).distinct('_id') : [];
      const allowedAgentIds = agentIds || [];
      allowedAgentIds.push(req.user._id);
      if (!allowedAgentIds.map(String).includes(existingLead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update leads associated with your agents.',
        });
      }
    }

    const updateData = { status };
    
    if (sanctionedDate !== undefined) {
      updateData.sanctionedDate = sanctionedDate || new Date();
    }

    if (disbursedAmount !== undefined) {
      const lead = await Lead.findById(req.params.id);
      const previousAmount = lead.disbursedAmount || 0;
      
      updateData.disbursedAmount = disbursedAmount;
      updateData.disbursementType = disbursementType || (disbursedAmount === lead.loanAmount ? 'full' : 'partial');

      // Add to disbursement history
      if (!lead.disbursementHistory) {
        lead.disbursementHistory = [];
      }
      lead.disbursementHistory.push({
        amount: disbursedAmount - previousAmount,
        date: new Date(),
        type: updateData.disbursementType,
      });
      updateData.disbursementHistory = lead.disbursementHistory;

      // If fully disbursed, mark as completed
      if (disbursedAmount >= (lead.loanAmount || 0)) {
        updateData.status = 'completed';
        updateData.disbursementType = 'full';

        // Auto-generate invoice when completed
        try {
          await commissionService.recalculateCommission(req.params.id);
          await invoiceService.generateInvoice(req.params.id);
        } catch (error) {
          console.error('Error auto-generating invoice:', error);
        }
      }

      // Recalculate commission if basis is disbursed
      if (lead.commissionBasis === 'disbursed') {
        await commissionService.recalculateCommission(req.params.id);
      }
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('agent', 'name email mobile')
      .populate('associated', 'name')
      .populate('bank', 'name type')
      .populate('smBm', 'name email mobile');

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    // Track changes - only check fields that were actually updated
    const fieldsToCheck = Object.keys(updateData);
    const changes = trackLeadChanges(existingLead.toObject(), lead.toObject(), fieldsToCheck);
    if (changes.length > 0) {
      await LeadHistory.create({
        lead: lead._id,
        changedBy: req.user._id,
        action: 'status_changed',
        changes,
        remarks: req.body.remarks || null,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lead status updated',
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Lead (Staff/Franchise Owner)
 */
export const verifyLead = async (req, res, next) => {
  try {
    const { verificationStatus, remarks, commissionPercentage } = req.body;

    if (!verificationStatus || !['verified', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status',
      });
    }

    // Check access before verifying
    const existingLead = await Lead.findById(req.params.id);
    if (!existingLead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
    }

    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      // Franchise owners can verify leads for agents under their franchise (and leads where they are the agent)
      const agentIds = await User.find({ managedByModel: 'Franchise', managedBy: req.user.franchiseOwned }).distinct('_id');
      const allowedAgentIds = (agentIds || []).map(String);
      allowedAgentIds.push(req.user._id.toString());
      if (!allowedAgentIds.includes(existingLead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only verify leads associated with your franchise agents.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = await regionalManagerCanAccessFranchise(req, existingLead.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only verify leads from franchises associated with you.',
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
      const agentIds = rmId ? await User.find({ managedByModel: 'RelationshipManager', managedBy: rmId }).distinct('_id') : [];
      const allowedAgentIds = agentIds || [];
      allowedAgentIds.push(req.user._id);
      if (!allowedAgentIds.map(String).includes(existingLead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only verify leads associated with your agents.',
        });
      }
    }

    const updateData = {
      verificationStatus,
      verifiedBy: req.user._id,
      verifiedAt: new Date(),
      remarks,
    };

    if (commissionPercentage !== undefined) {
      updateData.commissionPercentage = commissionPercentage;
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('agent', 'name email mobile')
      .populate('associated', 'name')
      .populate('bank', 'name type')
      .populate('smBm', 'name email mobile');

    // Track changes - only check fields that were actually updated
    const fieldsToCheck = Object.keys(updateData);
    const changes = trackLeadChanges(existingLead.toObject(), lead.toObject(), fieldsToCheck);
    if (changes.length > 0) {
      await LeadHistory.create({
        lead: lead._id,
        changedBy: req.user._id,
        action: 'verified',
        changes,
        remarks: remarks || null,
      });
    }

    // If verified, calculate commission
    if (verificationStatus === 'verified') {
      try {
        await commissionService.calculateCommission(req.params.id);
      } catch (error) {
        console.error('Error calculating commission:', error);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Lead verified successfully',
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get documents for a lead
 */
export const getLeadDocuments = async (req, res, next) => {
  try {
    const fileUploadService = (await import('../services/fileUpload.service.js')).default;
    const documents = await fileUploadService.getDocuments('lead', req.params.id);

    res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload document for a lead
 */
export const uploadLeadDocument = async (req, res, next) => {
  try {
    const fileUploadService = (await import('../services/fileUpload.service.js')).default;
    const upload = fileUploadService.getUploadMiddleware('file');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      const { documentType, description } = req.body;

      if (!documentType) {
        return res.status(400).json({
          success: false,
          message: 'Document type is required',
        });
      }

      const document = await fileUploadService.saveDocument({
        entityType: 'lead',
        entityId: req.params.id,
        documentType,
        fileName: req.file.filename,
        originalFileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user._id,
        description,
      });

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document,
      });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Lead
 */
export const deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = lead.associatedModel === 'Franchise'
        ? await regionalManagerCanAccessFranchise(req, lead.associated)
        : true;
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete leads from franchises associated with you.',
        });
      }
    }
    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      const agentIds = await User.find({ managedByModel: 'Franchise', managedBy: req.user.franchiseOwned }).distinct('_id');
      const allowedAgentIds = (agentIds || []).map(String);
      allowedAgentIds.push(req.user._id.toString());
      if (!allowedAgentIds.includes(lead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete leads associated with your franchise agents.',
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
      const agentIds = rmId ? await User.find({ managedByModel: 'RelationshipManager', managedBy: rmId }).distinct('_id') : [];
      const allowedAgentIds = agentIds || [];
      allowedAgentIds.push(req.user._id);
      if (!allowedAgentIds.map(String).includes(lead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete leads associated with your agents.',
        });
      }
    }
    await Lead.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Lead Version History
 */
export const getLeadHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Check if lead exists
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    // Role-based access control
    if (req.user.role === 'agent' && lead.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view history of your own leads.',
      });
    }

    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      const agentIds = await User.find({ managedByModel: 'Franchise', managedBy: req.user.franchiseOwned }).distinct('_id');
      const allowedAgentIds = (agentIds || []).map(String);
      allowedAgentIds.push(req.user._id.toString());
      if (!allowedAgentIds.includes(lead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view history of leads associated with your franchise agents.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = lead.associatedModel === 'Franchise'
        ? await regionalManagerCanAccessFranchise(req, lead.associated)
        : true;
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view history of leads from franchises associated with you.',
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
      const agentIds = rmId ? await User.find({ managedByModel: 'RelationshipManager', managedBy: rmId }).distinct('_id') : [];
      const allowedAgentIds = agentIds || [];
      allowedAgentIds.push(req.user._id);
      if (!allowedAgentIds.map(String).includes(lead.agent.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view history of leads associated with your agents.',
        });
      }
    }

    if (req.user.role === 'agent' && lead.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view history of your own leads.',
      });
    }

    const history = await LeadHistory.find({ lead: req.params.id })
      .populate('changedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await LeadHistory.countDocuments({ lead: req.params.id });
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: history,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};
