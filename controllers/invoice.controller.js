import invoiceService from '../services/invoice.service.js';
import { getPaginationMeta } from '../utils/helpers.js';
import Invoice from '../models/invoice.model.js';

/**
 * Get all invoices
 */
export const getInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, agentId, franchiseId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    
    // Role-based filtering
    if (req.user.role === 'agent') {
      query.agent = req.user._id;
    } else if (req.user.role === 'franchise') {
      // Franchise owners should only see invoices from their franchise
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      query.franchise = req.user.franchiseOwned;
    }

    if (status) query.status = status;
    if (agentId) query.agent = agentId;
    if (franchiseId) query.franchise = franchiseId;

    const invoices = await Invoice.find(query)
      .populate('agent', 'name email')
      .populate('franchise', 'name')
      .populate('lead', 'loanAccountNo loanType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice by ID
 */
export const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // Role-based access control
    if (req.user.role === 'agent' && invoice.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own invoices.',
      });
    }

    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      if (invoice.franchise?.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view invoices from your franchise.',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept invoice (Agent)
 */
export const acceptInvoice = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const invoice = await invoiceService.acceptInvoice(req.params.id, remarks);

    res.status(200).json({
      success: true,
      message: 'Invoice accepted successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Escalate invoice (Agent)
 */
export const escalateInvoice = async (req, res, next) => {
  try {
    const { reason, remarks } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Escalation reason is required',
      });
    }

    const invoice = await invoiceService.escalateInvoice(
      req.params.id,
      reason,
      remarks,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: 'Invoice escalated successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve escalation (Staff/Franchise Owner)
 */
export const resolveEscalation = async (req, res, next) => {
  try {
    const { resolutionRemarks, adjustments } = req.body;

    if (!resolutionRemarks) {
      return res.status(400).json({
        success: false,
        message: 'Resolution remarks are required',
      });
    }

    const invoice = await invoiceService.resolveEscalation(
      req.params.id,
      resolutionRemarks,
      req.user._id,
      adjustments
    );

    res.status(200).json({
      success: true,
      message: 'Escalation resolved successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve invoice (Staff/Accounts)
 */
export const approveInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.approveInvoice(req.params.id, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Invoice approved successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject invoice
 */
export const rejectInvoice = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const invoice = await invoiceService.rejectInvoice(
      req.params.id,
      rejectionReason,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: 'Invoice rejected',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Invoice
 */
export const createInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.create(req.body);

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('lead', 'loanAccountNo loanType')
      .populate('agent', 'name email')
      .populate('franchise', 'name');

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: populatedInvoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Invoice
 */
export const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('lead', 'loanAccountNo loanType')
      .populate('agent', 'name email')
      .populate('franchise', 'name');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Invoice
 */
export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
