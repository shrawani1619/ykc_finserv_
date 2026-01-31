import mongoose from 'mongoose';

/**
 * Email Log Model
 * Tracks all system-generated emails for audit and troubleshooting
 */
const emailLogSchema = new mongoose.Schema(
  {
    // Recipient details
    to: {
      type: String,
      required: true,
      index: true,
    },

    cc: [String],
    bcc: [String],

    // Email details
    subject: {
      type: String,
      required: true,
    },

    body: {
      type: String,
      required: true,
    },

    // Email status
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'bounced'],
      default: 'pending',
      index: true,
    },

    // Email type for categorization
    emailType: {
      type: String,
      index: true,
    },

    // Reference to related entity
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,

    // Error details if failed
    error: String,

    // Timestamps
    sentAt: Date,

    // Email service response
    serviceResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
emailLogSchema.index({ to: 1, createdAt: -1 });
emailLogSchema.index({ status: 1, createdAt: -1 });
emailLogSchema.index({ emailType: 1 });

export default mongoose.model('EmailLog', emailLogSchema);
