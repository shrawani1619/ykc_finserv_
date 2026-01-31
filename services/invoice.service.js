import Invoice from '../models/invoice.model.js';
import Lead from '../models/lead.model.js';
import { generateInvoiceNumber } from '../utils/helpers.js';

/**
 * Invoice Service
 * Handles invoice generation, approval workflow, and TDS calculation
 */
class InvoiceService {
  /**
   * Generate invoice for a completed lead
   * @param {ObjectId} leadId - Lead ID
   * @returns {Promise<Object>} Created invoice
   */
  async generateInvoice(leadId) {
    try {
      const lead = await Lead.findById(leadId)
        .populate('agent')
        .populate('franchise');

      if (!lead) {
        throw new Error('Lead not found');
      }

      // Check if lead is completed
      if (lead.status !== 'completed') {
        throw new Error('Lead must be completed before generating invoice');
      }

      // Check if invoice already exists
      if (lead.isInvoiceGenerated || lead.invoice) {
        const existingInvoice = await Invoice.findById(lead.invoice);
        if (existingInvoice) {
          return existingInvoice;
        }
      }

      // Get commission amount
      const commissionAmount = lead.actualCommission || lead.expectedCommission || 0;

      if (commissionAmount === 0) {
        throw new Error('Commission amount is zero, cannot generate invoice');
      }

      // Calculate TDS (2%)
      const tdsPercentage = 2;
      const tdsAmount = (commissionAmount * tdsPercentage) / 100;
      const netPayable = commissionAmount - tdsAmount;

      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber();

      // Create invoice
      const invoice = await Invoice.create({
        invoiceNumber,
        lead: leadId,
        agent: lead.agent._id,
        franchise: lead.franchise._id,
        commissionAmount,
        tdsAmount,
        tdsPercentage,
        netPayable,
        status: 'pending',
        invoiceDate: new Date(),
      });

      // Update lead
      lead.invoice = invoice._id;
      lead.isInvoiceGenerated = true;
      await lead.save();

      return invoice;
    } catch (error) {
      throw new Error(`Error generating invoice: ${error.message}`);
    }
  }

  /**
   * Agent accepts invoice
   * @param {ObjectId} invoiceId - Invoice ID
   * @param {String} remarks - Optional remarks from agent
   * @returns {Promise<Object>} Updated invoice
   */
  async acceptInvoice(invoiceId, remarks = '') {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'pending') {
        throw new Error('Invoice is not in pending status');
      }

      invoice.status = 'approved';
      invoice.acceptedAt = new Date();
      invoice.agentRemarks = remarks;

      await invoice.save();

      return invoice;
    } catch (error) {
      throw new Error(`Error accepting invoice: ${error.message}`);
    }
  }

  /**
   * Agent escalates invoice
   * @param {ObjectId} invoiceId - Invoice ID
   * @param {String} reason - Escalation reason
   * @param {String} remarks - Escalation remarks
   * @param {ObjectId} userId - User ID who escalated
   * @returns {Promise<Object>} Updated invoice
   */
  async escalateInvoice(invoiceId, reason, remarks, userId) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'pending') {
        throw new Error('Only pending invoices can be escalated');
      }

      invoice.status = 'escalated';
      invoice.isEscalated = true;
      invoice.escalationReason = reason;
      invoice.escalationRemarks = remarks;
      invoice.escalatedAt = new Date();
      invoice.escalatedBy = userId;

      await invoice.save();

      return invoice;
    } catch (error) {
      throw new Error(`Error escalating invoice: ${error.message}`);
    }
  }

  /**
   * Staff resolves escalated invoice
   * @param {ObjectId} invoiceId - Invoice ID
   * @param {String} resolutionRemarks - Resolution remarks
   * @param {ObjectId} userId - User ID who resolved
   * @param {Object} adjustments - Optional commission adjustments
   * @returns {Promise<Object>} Updated invoice
   */
  async resolveEscalation(invoiceId, resolutionRemarks, userId, adjustments = {}) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'escalated') {
        throw new Error('Invoice is not in escalated status');
      }

      // Apply adjustments if provided
      if (adjustments.commissionAmount) {
        invoice.commissionAmount = adjustments.commissionAmount;
        invoice.tdsAmount = (adjustments.commissionAmount * invoice.tdsPercentage) / 100;
        invoice.netPayable = adjustments.commissionAmount - invoice.tdsAmount;
      }

      invoice.status = 'pending';
      invoice.resolutionRemarks = resolutionRemarks;
      invoice.resolvedAt = new Date();
      invoice.resolvedBy = userId;

      await invoice.save();

      return invoice;
    } catch (error) {
      throw new Error(`Error resolving escalation: ${error.message}`);
    }
  }

  /**
   * Approve invoice (staff/accounts)
   * @param {ObjectId} invoiceId - Invoice ID
   * @param {ObjectId} userId - User ID who approved
   * @returns {Promise<Object>} Updated invoice
   */
  async approveInvoice(invoiceId, userId) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (!['pending', 'escalated'].includes(invoice.status)) {
        throw new Error('Invoice cannot be approved in current status');
      }

      invoice.status = 'approved';
      invoice.approvedAt = new Date();
      invoice.approvedBy = userId;

      // If it was escalated, mark as resolved
      if (invoice.isEscalated && !invoice.resolvedAt) {
        invoice.resolvedAt = new Date();
        invoice.resolvedBy = userId;
      }

      await invoice.save();

      return invoice;
    } catch (error) {
      throw new Error(`Error approving invoice: ${error.message}`);
    }
  }

  /**
   * Reject invoice
   * @param {ObjectId} invoiceId - Invoice ID
   * @param {String} rejectionReason - Reason for rejection
   * @param {ObjectId} userId - User ID who rejected
   * @returns {Promise<Object>} Updated invoice
   */
  async rejectInvoice(invoiceId, rejectionReason, userId) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      invoice.status = 'rejected';
      invoice.rejectionReason = rejectionReason;
      invoice.rejectedAt = new Date();
      invoice.rejectedBy = userId;

      await invoice.save();

      return invoice;
    } catch (error) {
      throw new Error(`Error rejecting invoice: ${error.message}`);
    }
  }

  /**
   * Get invoice by ID with all related data
   * @param {ObjectId} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice with populated fields
   */
  async getInvoiceById(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate('lead')
        .populate('agent')
        .populate('franchise')
        .populate('payout')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('escalatedBy', 'name email')
        .populate('resolvedBy', 'name email');

      return invoice;
    } catch (error) {
      throw new Error(`Error fetching invoice: ${error.message}`);
    }
  }
}

export default new InvoiceService();
