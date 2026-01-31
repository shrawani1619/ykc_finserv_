import mongoose from 'mongoose';

/**
 * Document Model
 * Manages file uploads and document tracking for leads, invoices, and other entities
 */
const documentSchema = new mongoose.Schema(
  {
    // Reference to the entity this document belongs to
    entityType: {
      type: String,
      enum: ['lead', 'invoice', 'payout', 'user', 'franchise'],
      required: true,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Document details
    documentType: {
      type: String,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    originalFileName: {
      type: String,
      required: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    // Verification status
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    verifiedAt: Date,

    verificationRemarks: String,

    // Upload metadata
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    description: String,
  },
  { timestamps: true }
);

// Compound index for efficient queries
documentSchema.index({ entityType: 1, entityId: 1 });
documentSchema.index({ verificationStatus: 1 });

export default mongoose.model('Document', documentSchema);
