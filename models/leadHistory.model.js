import mongoose from 'mongoose';

/**
 * Lead History Model
 * Tracks all changes made to lead data
 */
const leadHistorySchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    action: {
      type: String,
      enum: ['created', 'updated', 'status_changed', 'verified'],
      required: true,
    },

    changes: [
      {
        field: {
          type: String,
          required: true,
        },
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
      },
    ],

    remarks: String,
  },
  { timestamps: true }
);

// Indexes for efficient queries
leadHistorySchema.index({ lead: 1, createdAt: -1 });
leadHistorySchema.index({ changedBy: 1 });

export default mongoose.model('LeadHistory', leadHistorySchema);
