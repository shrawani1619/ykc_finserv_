import Payout from '../models/payout.model.js';
import Invoice from '../models/invoice.model.js';
import { generatePayoutNumber, generateBankCsv } from '../utils/helpers.js';

/**
 * Payout Service
 * Handles payout processing, bank CSV file generation, and payment confirmation
 */
class PayoutService {
  /**
   * Process payouts for approved invoices
   * @param {Array<ObjectId>} invoiceIds - Array of invoice IDs
   * @param {ObjectId} userId - User ID processing the payout
   * @returns {Promise<Object>} Created payout
   */
  async processPayouts(invoiceIds, userId) {
    try {
      if (!invoiceIds || invoiceIds.length === 0) {
        throw new Error('At least one invoice is required');
      }

      // Fetch invoices
      const invoices = await Invoice.find({
        _id: { $in: invoiceIds },
        status: 'approved',
      }).populate('agent').populate('franchise');

      if (invoices.length === 0) {
        throw new Error('No approved invoices found');
      }

      // Group by agent (one payout per agent)
      const agentPayouts = {};
      
      for (const invoice of invoices) {
        const agentId = invoice.agent._id.toString();
        
        if (!agentPayouts[agentId]) {
          agentPayouts[agentId] = {
            agent: invoice.agent._id,
            franchise: invoice.franchise._id,
            invoices: [],
            totalAmount: 0,
            tdsAmount: 0,
            bankDetails: invoice.agent.bankDetails || {},
          };
        }

        agentPayouts[agentId].invoices.push(invoice._id);
        agentPayouts[agentId].totalAmount += invoice.commissionAmount;
        agentPayouts[agentId].tdsAmount += invoice.tdsAmount;
      }

      // Create payout for each agent
      const payouts = [];
      
      for (const agentId in agentPayouts) {
        const payoutData = agentPayouts[agentId];
        const payoutNumber = await generatePayoutNumber();

        const payout = await Payout.create({
          payoutNumber,
          invoices: payoutData.invoices,
          agent: payoutData.agent,
          franchise: payoutData.franchise,
          totalAmount: payoutData.totalAmount,
          tdsAmount: payoutData.tdsAmount,
          netPayable: payoutData.totalAmount - payoutData.tdsAmount,
          bankDetails: payoutData.bankDetails,
          status: 'pending',
          processedBy: userId,
          processedAt: new Date(),
        });

        // Update invoices with payout reference
        await Invoice.updateMany(
          { _id: { $in: payoutData.invoices } },
          { payout: payout._id }
        );

        payouts.push(payout);
      }

      return payouts.length === 1 ? payouts[0] : payouts;
    } catch (error) {
      throw new Error(`Error processing payouts: ${error.message}`);
    }
  }

  /**
   * Generate bank CSV file for payout
   * @param {ObjectId} payoutId - Payout ID
   * @param {ObjectId} userId - User ID generating the file
   * @returns {Promise<Object>} Payout with CSV file details
   */
  async generateBankCsvFile(payoutId, userId) {
    try {
      const payout = await Payout.findById(payoutId)
        .populate('agent')
        .populate('invoices');

      if (!payout) {
        throw new Error('Payout not found');
      }

      // Generate CSV file
      const csvData = await generateBankCsv(payout);

      // Update payout with file details
      payout.bankCsvFile = {
        filename: `payout_${payout.payoutNumber}_${Date.now()}.csv`,
        path: csvData.path,
        generatedAt: new Date(),
        generatedBy: userId,
      };

      payout.status = 'processing';
      await payout.save();

      return payout;
    } catch (error) {
      throw new Error(`Error generating bank CSV file: ${error.message}`);
    }
  }

  /**
   * Confirm payment for a payout
   * @param {ObjectId} payoutId - Payout ID
   * @param {Object} paymentData - Payment confirmation data
   * @param {ObjectId} userId - User ID confirming payment
   * @returns {Promise<Object>} Updated payout
   */
  async confirmPayment(payoutId, paymentData, userId) {
    try {
      const payout = await Payout.findById(payoutId);
      if (!payout) {
        throw new Error('Payout not found');
      }

      if (payout.status === 'paid') {
        throw new Error('Payout is already marked as paid');
      }

      payout.status = 'paid';
      payout.paymentConfirmation = {
        transactionId: paymentData.transactionId,
        transactionDate: paymentData.transactionDate || new Date(),
        paymentMethod: paymentData.paymentMethod || 'NEFT',
        uploadedFile: paymentData.uploadedFile || '',
        confirmedAt: new Date(),
        confirmedBy: userId,
      };

      await payout.save();

      // Update invoice statuses
      await Invoice.updateMany(
        { payout: payoutId },
        { status: 'paid' }
      );

      return payout;
    } catch (error) {
      throw new Error(`Error confirming payment: ${error.message}`);
    }
  }

  /**
   * Mark payout as failed
   * @param {ObjectId} payoutId - Payout ID
   * @param {String} remarks - Failure remarks
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Object>} Updated payout
   */
  async markPayoutFailed(payoutId, remarks, userId) {
    try {
      const payout = await Payout.findById(payoutId);
      if (!payout) {
        throw new Error('Payout not found');
      }

      payout.status = 'failed';
      payout.remarks = remarks;
      await payout.save();

      return payout;
    } catch (error) {
      throw new Error(`Error marking payout as failed: ${error.message}`);
    }
  }

  /**
   * Get payout by ID with all related data
   * @param {ObjectId} payoutId - Payout ID
   * @returns {Promise<Object>} Payout with populated fields
   */
  async getPayoutById(payoutId) {
    try {
      const payout = await Payout.findById(payoutId)
        .populate('invoices')
        .populate('agent')
        .populate('franchise')
        .populate('processedBy', 'name email')
        .populate('confirmedBy', 'name email');

      return payout;
    } catch (error) {
      throw new Error(`Error fetching payout: ${error.message}`);
    }
  }
}

export default new PayoutService();
