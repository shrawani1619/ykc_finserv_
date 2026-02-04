import mongoose from 'mongoose';

/**
 * Franchise Model (Enhanced)
 * Manages franchise information with owner reference and performance metrics
 */
const franchiseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },

    ownerName: String,

    // Owner reference (User with franchise role)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    email: {
      type: String,
      unique: true,
      lowercase: true,
      sparse: true,
    },

    mobile: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Commission structure for this franchise
    commissionStructure: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Performance metrics (can be calculated or updated periodically)
    performanceMetrics: {
      totalLeads: {
        type: Number,
        default: 0,
      },
      activeAgents: {
        type: Number,
        default: 0,
      },
      totalCommission: {
        type: Number,
        default: 0,
      },
      lastUpdated: Date,
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },

    regionalManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Additional metadata
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
  },
  { timestamps: true }
);

// Indexes
franchiseSchema.index({ owner: 1, status: 1 });
franchiseSchema.index({ status: 1 });
franchiseSchema.index({ regionalManager: 1 });

export default mongoose.model('Franchise', franchiseSchema);
