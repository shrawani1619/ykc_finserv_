import mongoose from 'mongoose';

/**
 * Audit Log Model
 * Tracks all user actions and system changes for compliance and auditing
 */
const auditLogSchema = new mongoose.Schema(
  {
    // User who performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Action details
    action: {
      type: String,
      required: true,
      index: true,
    },

    // Entity that was affected
    entityType: {
      type: String,
      required: true,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Change details
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    previousValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // IP address and user agent
    ipAddress: String,
    userAgent: String,

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
