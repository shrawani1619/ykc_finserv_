import mongoose from 'mongoose';

/**
 * Commission Rule Model
 * Defines bank-specific commission rules and calculation basis
 */
const commissionRuleSchema = new mongoose.Schema(
  {
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: true,
      index: true,
    },

    loanType: {
      type: String,
      enum: ['personal_loan', 'home_loan', 'business_loan',
         'loan_against_property', 'education_loan', 'car_loan', 'gold_loan', 'all'],
      required: true,
      index: true,
    },

    // Commission calculation basis
    commissionBasis: {
      type: String,
      enum: ['sanctioned', 'disbursed'],
      required: true,
    },

    // Commission type
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },

    // Commission value (percentage or fixed amount)
    commissionValue: {
      type: Number,
      required: true,
    },

    // Minimum commission amount (optional)
    minCommission: Number,

    // Maximum commission amount (optional)
    maxCommission: Number,

    // Effective date range
    effectiveFrom: {
      type: Date,
      required: true,
    },

    effectiveTo: {
      type: Date,
      default: null, // null means no expiry
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },

    // Additional conditions (optional JSON field for complex rules)
    conditions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
commissionRuleSchema.index({ bank: 1, loanType: 1, status: 1 });
commissionRuleSchema.index({ effectiveFrom: 1, effectiveTo: 1 });

// Method to check if rule is currently effective
commissionRuleSchema.methods.isEffective = function (date = new Date()) {
  if (this.status !== 'active') return false;
  if (date < this.effectiveFrom) return false;
  if (this.effectiveTo && date > this.effectiveTo) return false;
  return true;
};

export default mongoose.model('CommissionRule', commissionRuleSchema);
