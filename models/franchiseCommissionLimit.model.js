import mongoose from 'mongoose';

/**
 * Franchise Commission Limit Model
 * Stores maximum commission limits set by admin for each bank
 * These limits apply to franchise users when creating leads
 */
const franchiseCommissionLimitSchema = new mongoose.Schema(
  {
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: true,
      index: true,
    },
    
    // Commission limit type: 'amount' or 'percentage'
    limitType: {
      type: String,
      enum: ['amount', 'percentage'],
      required: true,
    },
    
    // Maximum commission value
    // If limitType is 'amount', this is in ₹
    // If limitType is 'percentage', this is a percentage (e.g., 5 for 5%)
    maxCommissionValue: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Created/Updated by admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one limit per bank
franchiseCommissionLimitSchema.index({ bank: 1 }, { unique: true });

const FranchiseCommissionLimit = mongoose.model('FranchiseCommissionLimit', franchiseCommissionLimitSchema);

export default FranchiseCommissionLimit;

