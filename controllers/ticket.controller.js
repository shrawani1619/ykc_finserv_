import mongoose from 'mongoose';
import Ticket, { TICKET_CATEGORIES_LIST, TICKET_STATUSES_LIST } from '../models/ticket.model.js';
import User from '../models/user.model.js';
import Lead from '../models/lead.model.js';
import RelationshipManager from '../models/relationship.model.js';
import Franchise from '../models/franchise.model.js';
import fileUploadService from '../services/fileUpload.service.js';
import { getRegionalManagerFranchiseIds, getRegionalManagerRelationshipManagerIds } from '../utils/regionalScope.js';
import {
  getAssignedUserForAgent,
  calculateSLADeadline,
  generateTicketId,
  createNotification,
} from '../services/ticket.service.js';
import { getPaginationMeta } from '../utils/helpers.js';

/**
 * Create Ticket (Agent only) - supports optional file upload
 */
export const createTicket = async (req, res, next) => {
  try {
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Only agents can raise tickets',
      });
    }

    // Support both JSON and multipart/form-data
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const category = body.category || req.body?.category;
    const description = body.description || req.body?.description;
    const attachment = body.attachment || req.body?.attachment;
    const leadId = body.leadId || req.body?.leadId;

    if (!category || !TICKET_CATEGORIES_LIST.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category is required',
      });
    }

    if (!description?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Description is required',
      });
    }

    const { assignedUser, assignedRole } = await getAssignedUserForAgent(req.user._id);

    if (!assignedUser) {
      return res.status(400).json({
        success: false,
        message: 'Could not determine assigned Relationship Manager. Please contact support.',
      });
    }

    // Validate optional lead - must belong to this agent
    let leadRef = null;
    if (leadId) {
      const lead = await Lead.findOne({ _id: leadId, agent: req.user._id }).select('_id').lean();
      if (!lead) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or unauthorized lead selection',
        });
      }
      leadRef = lead._id;
    }

    const ticketId = await generateTicketId();
    const { slaDeadline, slaTimerStartedAt } = calculateSLADeadline(new Date());

    let attachmentData = attachment || {};

    // Handle file upload if present
    const incomingFile = req.file || (Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : null);

    const ticket = await Ticket.create({
      ticketId,
      raisedBy: req.user._id,
      agentName: req.user.name,
      category,
      description: description.trim(),
      lead: leadRef,
      attachment: attachmentData,
      status: 'Open',
      escalationLevel: 1,
      assignedRole,
      assignedTo: assignedUser._id,
      slaDeadline,
      slaTimerStartedAt,
    });

    if (incomingFile) {
      const doc = await fileUploadService.processUploadedFile(incomingFile, {
        entityType: 'ticket',
        entityId: ticket._id,
        documentType: 'attachment',
        uploadedBy: req.user._id,
      });

      ticket.attachment = {
        url: doc.url || doc.filePath,
        fileName: doc.fileName,
        originalName: doc.originalFileName,
      };
      await ticket.save();
    }

    // Notify assigned user (RM/Franchise)
    await createNotification(
      assignedUser._id,
      'New service request assigned by Agent',
      `${req.user.name} – ${category}`,
      ticket._id,
      'ticket_assigned'
    );

    const populated = await Ticket.findById(ticket._id)
      .populate('raisedBy', 'name email')
      .populate('assignedTo', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Ticket raised successfully',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get agent IDs under the current user (hierarchy)
 * RM/Franchise: agents they manage. Regional Manager: agents under their RMs/Franchises.
 */
async function getAgentIdsUnderUser(req) {
  if (req.user.role === 'agent') return [req.user._id];
  if (req.user.role === 'relationship_manager') {
    let rmId = req.user.relationshipManagerOwned;
    if (!rmId) {
      const rmDoc = await RelationshipManager.findOne({ owner: req.user._id }).select('_id').lean();
      rmId = rmDoc?._id;
    }
    if (!rmId) return [];
    const ids = await User.find({ managedByModel: 'RelationshipManager', managedBy: rmId }).distinct('_id');
    return ids || [];
  }
  if (req.user.role === 'franchise') {
    const franchiseId = req.user.franchiseOwned || req.user.franchise;
    if (!franchiseId) return [];
    const ids = await User.find({ managedByModel: 'Franchise', managedBy: franchiseId }).distinct('_id');
    return ids || [];
  }
  if (req.user.role === 'regional_manager') {
    const franchiseIds = await getRegionalManagerFranchiseIds(req);
    const rmIds = await getRegionalManagerRelationshipManagerIds(req);
    const agentIdsFromFranchise = franchiseIds?.length
      ? await User.find({ managedByModel: 'Franchise', managedBy: { $in: franchiseIds } }).distinct('_id')
      : [];
    const agentIdsFromRM = rmIds?.length
      ? await User.find({ managedByModel: 'RelationshipManager', managedBy: { $in: rmIds } }).distinct('_id')
      : [];
    const combined = [...(agentIdsFromFranchise || []), ...(agentIdsFromRM || [])];
    const unique = [...new Set(combined.map((id) => id.toString()))];
    return unique.map((id) => new mongoose.Types.ObjectId(id));
  }
  return [];
}

/**
 * Get Tickets (hierarchy-based - strict: only tickets from agents directly under the user)
 * - If agent is under Franchise → only Franchise owner sees it
 * - If agent is under RM → only RM sees it
 * - Regional Manager sees tickets from agents under their RMs/Franchises
 */
export const getTickets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category, escalationLevel } = req.query;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.user.role === 'agent') {
      query.raisedBy = req.user._id;
    } else if (req.user.role === 'relationship_manager') {
      // RM: STRICT - Only tickets from agents directly under this RM (managedByModel='RelationshipManager')
      // This ensures RM does NOT see tickets from franchise agents
      let rmId = req.user.relationshipManagerOwned;
      if (!rmId) {
        const rmDoc = await RelationshipManager.findOne({ owner: req.user._id }).select('_id').lean();
        rmId = rmDoc?._id;
      }
      if (!rmId) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      // Get ONLY agents directly under this RM (excludes franchise agents)
      const agentIds = await User.find({ 
        role: 'agent',
        managedByModel: 'RelationshipManager', 
        managedBy: rmId 
      }).distinct('_id');
      if (agentIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      // Only tickets raised by these RM agents
      query.raisedBy = { $in: agentIds };
    } else if (req.user.role === 'franchise') {
      // Franchise: STRICT - Only tickets from agents directly under this Franchise (managedByModel='Franchise')
      // This ensures Franchise does NOT see tickets from RM agents
      const franchiseId = req.user.franchiseOwned || req.user.franchise;
      if (!franchiseId) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      // Get ONLY agents directly under this Franchise (excludes RM agents)
      const agentIds = await User.find({ 
        role: 'agent',
        managedByModel: 'Franchise', 
        managedBy: franchiseId 
      }).distinct('_id');
      if (agentIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      // Only tickets raised by these Franchise agents
      query.raisedBy = { $in: agentIds };
    } else if (req.user.role === 'regional_manager') {
      // Regional Manager: Tickets from agents under their RMs/Franchises
      const agentIds = await getAgentIdsUnderUser(req);
      if (agentIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: getPaginationMeta(page, limit, 0),
        });
      }
      query.raisedBy = { $in: agentIds };
    }
    // super_admin: no filter - sees all tickets

    if (status) query.status = status;
    if (category) query.category = category;
    if (escalationLevel) query.escalationLevel = parseInt(escalationLevel);

    const tickets = await Ticket.find(query)
      .populate('raisedBy', 'name email')
      .populate('assignedTo', 'name email role')
      .populate('lead', 'customerName applicantMobile applicantEmail status loanAmount loanAccountNo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Ticket.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: tickets,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Ticket By ID
 */
export const getTicketById = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('raisedBy', 'name email mobile')
      .populate('assignedTo', 'name email role')
      .populate('lead', 'customerName applicantMobile applicantEmail status loanAmount loanAccountNo')
      .populate('internalNotes.addedBy', 'name email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Role-based access
    if (req.user.role === 'agent') {
      if (ticket.raisedBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (['relationship_manager', 'franchise', 'regional_manager'].includes(req.user.role)) {
      if (ticket.assignedTo && ticket.assignedTo._id.toString() !== req.user._id.toString()) {
        // Check if user is in hierarchy (RM/Franchise/Regional Manager of the ticket)
        const canAccess = await canUserAccessTicket(req.user, ticket);
        if (!canAccess) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }
    // super_admin can access all

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

async function canUserAccessTicket(user, ticket) {
  if (user.role === 'super_admin') return true;
  const assignedId = ticket.assignedTo?._id || ticket.assignedTo;
  if (assignedId && assignedId.toString() === user._id.toString()) return true;

  const agent = await User.findById(ticket.raisedBy._id).select('managedBy managedByModel').lean();
  if (!agent) return false;

  if (agent.managedByModel === 'RelationshipManager') {
    const rm = await RelationshipManager.findById(agent.managedBy).select('owner regionalManager').lean();
    if (!rm) return false;
    if (user.role === 'relationship_manager' && rm.owner?.toString() === user._id.toString()) return true;
    if (user.role === 'regional_manager' && rm.regionalManager?.toString() === user._id.toString()) return true;
  } else if (agent.managedByModel === 'Franchise') {
    const franchise = await Franchise.findById(agent.managedBy).select('owner regionalManager').lean();
    if (!franchise) return false;
    if (user.role === 'franchise' && franchise.owner?.toString() === user._id.toString()) return true;
    if (user.role === 'regional_manager' && franchise.regionalManager?.toString() === user._id.toString()) return true;
  }

  return false;
}

/**
 * Update Ticket (status, add internal notes, reassign)
 */
export const updateTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const canAccess = await canUserAccessTicket(req.user, ticket);
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString();
    if (!canAccess && !isAssigned && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { status, reassignTo, internalNote } = req.body;

    const updatePayload = {};

    if (status && TICKET_STATUSES_LIST.includes(status)) {
      if (status === 'Resolved') {
        return res.status(400).json({
          success: false,
          message: 'Use the resolve endpoint to resolve a ticket',
        });
      }
      updatePayload.status = status;
    }

    if (internalNote?.trim()) {
      updatePayload.$push = {
        internalNotes: {
          note: internalNote.trim(),
          addedBy: req.user._id,
          addedAt: new Date(),
        },
      };
    }

    if (reassignTo && (req.user.role === 'super_admin' || req.user.role === 'regional_manager')) {
      const newUser = await User.findById(reassignTo).select('role name');
      if (!newUser) {
        return res.status(400).json({ success: false, message: 'Invalid user to reassign' });
      }
      const oldAssigned = ticket.assignedTo;
      updatePayload.assignedTo = newUser._id;
      updatePayload.assignedRole = newUser.role;

      // Notify new assignee
      await createNotification(
        newUser._id,
        'Service Request reassigned to you',
        `SRN ${ticket.ticketId} has been reassigned`,
        ticket._id,
        'ticket_reassigned'
      );

      if (oldAssigned && oldAssigned.toString() !== newUser._id.toString()) {
        await createNotification(
          oldAssigned,
          'Service Request reassigned',
          `SRN ${ticket.ticketId} has been reassigned to another user`,
          ticket._id,
          'ticket_reassigned'
        );
      }
    }

    const updateOp = { ...updatePayload };
    delete updateOp.$push;

    const updated = await Ticket.findByIdAndUpdate(
      req.params.id,
      { ...updateOp, ...(updatePayload.$push && { $push: updatePayload.$push }) },
      { new: true, runValidators: true }
    )
      .populate('raisedBy', 'name email')
      .populate('assignedTo', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve Ticket (RM, Franchise, Regional Manager only - Admin cannot resolve)
 */
export const resolveTicket = async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin cannot resolve tickets. You can reassign or add notes.',
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const canAccess = await canUserAccessTicket(req.user, ticket);
    if (!canAccess && ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { resolutionNote } = req.body;

    const updated = await Ticket.findByIdAndUpdate(
      req.params.id,
      {
        status: 'Resolved',
        resolvedAt: new Date(),
        resolvedBy: req.user._id,
        resolutionNote: resolutionNote || '',
      },
      { new: true }
    )
      .populate('raisedBy', 'name email')
      .populate('assignedTo', 'name email role')
      .populate('resolvedBy', 'name email');

    // Notify agent
    await createNotification(
      ticket.raisedBy,
      'Your service request has been resolved',
      `SRN ${ticket.ticketId} – ${ticket.category}`,
      ticket._id,
      'ticket_resolved'
    );

    res.status(200).json({
      success: true,
      message: 'Ticket resolved successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ticket categories
 */
export const getTicketCategories = (req, res) => {
  res.status(200).json({
    success: true,
    data: TICKET_CATEGORIES_LIST,
  });
};

