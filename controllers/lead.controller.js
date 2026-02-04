import mongoose from 'mongoose';
import Lead from '../models/lead.model.js';
import LeadHistory from '../models/leadHistory.model.js';
import User from '../models/user.model.js';
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
    let franchiseId = req.body.franchise;

    if (req.user.role === 'agent') {
      agentId = req.user._id;
      franchiseId = req.user.franchise;
    }
    if (req.user.role === 'regional_manager' && franchiseId) {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds !== null && franchiseIds.length > 0) {
        const allowed = franchiseIds.some((fid) => fid.toString() === franchiseId.toString());
        if (!allowed) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only create leads for franchises associated with you.',
          });
        }
      }
    }

    const leadData = {
      ...req.body,
      agent: agentId,
      franchise: franchiseId,
    };

    // Validate agent ID format
    if (leadData.agent && !mongoose.Types.ObjectId.isValid(leadData.agent)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format',
      });
    }

    console.log('🔍 DEBUG: Creating lead with agent:', leadData.agent);

    const lead = await Lead.create(leadData);

    const populatedLead = await Lead.findById(lead._id)
      .populate('agent', 'name email mobile')
      .populate('franchise', 'name')
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
    const { page = 1, limit = 10, status, verificationStatus, agentId, franchiseId, bankId } = req.query;
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
      query.franchise = req.user.franchiseOwned;
    } else if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds === null || franchiseIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      query.franchise = { $in: franchiseIds };
    }
    // super_admin / relationship_manager: no base filter → all leads; optional filters below

    if (status) query.status = status;
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (bankId) query.bank = bankId;
    const canFilterScope = ['super_admin', 'relationship_manager'].includes(req.user.role);
    if (canFilterScope) {
      if (agentId) query.agent = agentId;
      if (franchiseId) query.franchise = franchiseId;
    }

    const leads = await Lead.find(query)
      .populate('agent', 'name email mobile')
      .populate('franchise', 'name')
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
      .populate('franchise', 'name')
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
      if (lead.franchise.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view leads from your franchise.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = await regionalManagerCanAccessFranchise(req, lead.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view leads from franchises associated with you.',
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
      if (existingLead.franchise.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update leads from your franchise.',
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
      .populate('franchise', 'name')
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
    const { status, sanctionedAmount, sanctionedDate, disbursedAmount, disbursementType } = req.body;

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
      if (existingLead.franchise.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update leads from your franchise.',
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

    const updateData = { status };
    
    if (sanctionedAmount !== undefined) {
      updateData.sanctionedAmount = sanctionedAmount;
      updateData.sanctionedDate = sanctionedDate || new Date();
    }

    if (disbursedAmount !== undefined) {
      const lead = await Lead.findById(req.params.id);
      const previousAmount = lead.disbursedAmount || 0;
      
      updateData.disbursedAmount = disbursedAmount;
      updateData.disbursementType = disbursementType || (disbursedAmount === lead.sanctionedAmount ? 'full' : 'partial');

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
      if (disbursedAmount >= lead.sanctionedAmount) {
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
      .populate('franchise', 'name')
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
      if (existingLead.franchise.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only verify leads from your franchise.',
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
      .populate('franchise', 'name')
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
      const canAccess = await regionalManagerCanAccessFranchise(req, lead.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete leads from franchises associated with you.',
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
      if (lead.franchise.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view history of leads from your franchise.',
        });
      }
    }
    if (req.user.role === 'regional_manager') {
      const canAccess = await regionalManagerCanAccessFranchise(req, lead.franchise);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view history of leads from franchises associated with you.',
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
