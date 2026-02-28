import mongoose from 'mongoose';

/**
 * Form 16 / TDS Model
 * Manages Form 16 and TDS documents
 */
const form16Schema = new mongoose.Schema(
  {
    formType: {
      type: String,
      enum: ['form16', 'form16a', 'tds'],
      default: 'form16',
      index: true,
    },

    // User-provided name for the attachment
    attachmentName: {
      type: String,
      trim: true,
      index: true,
    },

    // Attachment URL or path (stored after file upload)
    attachment: {
      type: String,
      required: true,
    },

    // User reference - Form 16 assigned to this user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Attachment date (optional now)
    attachmentDate: {
      type: Date,
      index: true,
    },

    // File metadata
    fileName: String,
    fileSize: Number,
    mimeType: String,

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

form16Schema.index({ formType: 1, attachmentDate: -1 });
form16Schema.index({ status: 1, createdAt: -1 });
form16Schema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Form16', form16Schema);

