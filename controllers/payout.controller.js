import payoutService from '../services/payout.service.js';
import { getPaginationMeta } from '../utils/helpers.js';
import Payout from '../models/payout.model.js';

/**
 * Get all payouts
 */
export const getPayouts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, agentId, franchiseId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};

    // Role-based filtering
    if (req.user.role === 'agent') {
      // Agents are stored in User model, so use User._id directly
      query.agent = req.user._id;
    } else if (req.user.role === 'franchise') {
      // Franchise owners should only see payouts from their franchise
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

    const payouts = await Payout.find(query)
      .populate('agent', 'name email')
      .populate('franchise', 'name')
      .populate('invoices')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payout.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: payouts,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payout by ID
 */
export const getPayoutById = async (req, res, next) => {
  try {
    const payout = await payoutService.getPayoutById(req.params.id);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found',
      });
    }

    // Role-based access control
    if (req.user.role === 'agent' && payout.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own payouts.',
      });
    }

    if (req.user.role === 'franchise') {
      if (!req.user.franchiseOwned) {
        return res.status(400).json({
          success: false,
          message: 'Franchise owner does not have an associated franchise',
        });
      }
      if (payout.franchise?.toString() !== req.user.franchiseOwned.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view payouts from your franchise.',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: payout,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process payouts for approved invoices
 */
export const processPayouts = async (req, res, next) => {
  try {
    const { invoiceIds } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one invoice ID is required',
      });
    }

    const payouts = await payoutService.processPayouts(invoiceIds, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Payouts processed successfully',
      data: payouts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate bank CSV file for payout
 */
export const generateBankCsvFile = async (req, res, next) => {
  try {
    const payout = await payoutService.generateBankCsvFile(req.params.id, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Bank CSV file generated successfully',
      data: payout,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm payment
 */
export const confirmPayment = async (req, res, next) => {
  try {
    const { transactionId, transactionDate, paymentMethod, uploadedFile } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required',
      });
    }

    const payout = await payoutService.confirmPayment(
      req.params.id,
      {
        transactionId,
        transactionDate,
        paymentMethod,
        uploadedFile,
      },
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      data: payout,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Payout
 */
export const createPayout = async (req, res, next) => {
  try {
    // Generate payoutNumber if not provided
    const { generatePayoutNumber } = await import('../utils/helpers.js');
    const payoutData = {
      ...req.body,
      payoutNumber: req.body.payoutNumber || await generatePayoutNumber(),
    };

    console.log('🔍 DEBUG: Creating payout with data:', {
      payoutNumber: payoutData.payoutNumber,
      agent: payoutData.agent,
      franchise: payoutData.franchise,
      totalAmount: payoutData.totalAmount,
      netPayable: payoutData.netPayable,
      status: payoutData.status
    });

    const payout = await Payout.create(payoutData);

    const populatedPayout = await Payout.findById(payout._id)
      .populate('agent', 'name email mobile')
      .populate('franchise', 'name')
      .populate('invoices');

    console.log('🔍 DEBUG: Created payout:', {
      payoutId: populatedPayout._id,
      agent: populatedPayout.agent,
      agentName: populatedPayout.agent?.name
    });

    res.status(201).json({
      success: true,
      message: 'Payout created successfully',
      data: populatedPayout,
    });
  } catch (error) {
    console.error('🔍 DEBUG: Create payout error:', error);
    next(error);
  }
};

/**
 * Update Payout
 */
export const updatePayout = async (req, res, next) => {
  try {
    const payout = await Payout.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('agent', 'name email')
      .populate('franchise', 'name')
      .populate('invoices');

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payout updated successfully',
      data: payout,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Payout
 */
export const deletePayout = async (req, res, next) => {
  try {
    const payout = await Payout.findByIdAndDelete(req.params.id);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payout deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
