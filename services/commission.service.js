import CommissionRule from '../models/commissionRule.model.js';
import Lead from '../models/lead.model.js';

/**
 * Commission Calculation Service
 * Handles commission calculation based on bank rules, loan type, and disbursement basis
 */
class CommissionService {
  /**
   * Get commission rule for a specific bank and loan type
   * @param {ObjectId} bankId - Bank ID
   * @param {String} loanType - Type of loan
   * @param {Date} date - Date to check rule effectiveness
   * @returns {Promise<Object>} Commission rule or null
   */
  async getCommissionRule(bankId, loanType, date = new Date()) {
    try {
      // First try to find specific rule for loan type
      let rule = await CommissionRule.findOne({
        bank: bankId,
        loanType: loanType,
        status: 'active',
        effectiveFrom: { $lte: date },
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: date } },
        ],
      }).sort({ effectiveFrom: -1 });

      // If no specific rule, try 'all' loan type
      if (!rule) {
        rule = await CommissionRule.findOne({
          bank: bankId,
          loanType: 'all',
          status: 'active',
          effectiveFrom: { $lte: date },
          $or: [
            { effectiveTo: null },
            { effectiveTo: { $gte: date } },
          ],
        }).sort({ effectiveFrom: -1 });
      }

      return rule;
    } catch (error) {
      throw new Error(`Error fetching commission rule: ${error.message}`);
    }
  }

  /**
   * Calculate commission for a lead based on rules
   * @param {ObjectId} leadId - Lead ID
   * @returns {Promise<Object>} Commission calculation result
   */
  async calculateCommission(leadId) {
    try {
      const lead = await Lead.findById(leadId).populate('bank');
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Get commission rule
      const rule = await this.getCommissionRule(
        lead.bank._id,
        lead.loanType
      );

      if (!rule) {
        return {
          commission: 0,
          commissionPercentage: 0,
          rule: null,
          message: 'No commission rule found for this bank and loan type',
        };
      }

      // Determine base amount based on commission basis
      let baseAmount = 0;
      if (rule.commissionBasis === 'sanctioned') {
        baseAmount = lead.sanctionedAmount || 0;
      } else {
        // disbursed basis
        baseAmount = lead.disbursedAmount || 0;
      }

      if (baseAmount === 0) {
        return {
          commission: 0,
          commissionPercentage: rule.commissionValue,
          rule: rule,
          message: 'Base amount is zero, commission cannot be calculated',
        };
      }

      // Calculate commission based on type
      let commission = 0;
      if (rule.commissionType === 'percentage') {
        commission = (baseAmount * rule.commissionValue) / 100;
      } else {
        // fixed amount
        commission = rule.commissionValue;
      }

      // Apply min/max constraints
      if (rule.minCommission && commission < rule.minCommission) {
        commission = rule.minCommission;
      }
      if (rule.maxCommission && commission > rule.maxCommission) {
        commission = rule.maxCommission;
      }

      // Update lead with commission details
      lead.commissionBasis = rule.commissionBasis;
      lead.commissionPercentage =
        rule.commissionType === 'percentage' ? rule.commissionValue : 0;
      lead.expectedCommission = commission;
      lead.actualCommission = commission;

      await lead.save();

      return {
        commission: commission,
        commissionPercentage:
          rule.commissionType === 'percentage' ? rule.commissionValue : 0,
        rule: rule,
        baseAmount: baseAmount,
        commissionBasis: rule.commissionBasis,
      };
    } catch (error) {
      throw new Error(`Error calculating commission: ${error.message}`);
    }
  }

  /**
   * Recalculate commission when disbursement is updated
   * @param {ObjectId} leadId - Lead ID
   * @returns {Promise<Object>} Updated commission calculation
   */
  async recalculateCommission(leadId) {
    try {
      return await this.calculateCommission(leadId);
    } catch (error) {
      throw new Error(
        `Error recalculating commission: ${error.message}`
      );
    }
  }

  /**
   * Handle partial disbursement commission
   * @param {ObjectId} leadId - Lead ID
   * @param {Number} disbursedAmount - New disbursed amount
   * @returns {Promise<Object>} Commission for partial disbursement
   */
  async calculatePartialDisbursementCommission(leadId, disbursedAmount) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Update disbursed amount
      lead.disbursedAmount = disbursedAmount;
      lead.disbursementType = 'partial';

      // Recalculate commission if basis is disbursed
      const rule = await this.getCommissionRule(lead.bank, lead.loanType);
      if (rule && rule.commissionBasis === 'disbursed') {
        return await this.recalculateCommission(leadId);
      }

      // If basis is sanctioned, commission remains same
      return {
        commission: lead.actualCommission || 0,
        message: 'Commission based on sanctioned amount, no change required',
      };
    } catch (error) {
      throw new Error(
        `Error calculating partial disbursement commission: ${error.message}`
      );
    }
  }
}

export default new CommissionService();
