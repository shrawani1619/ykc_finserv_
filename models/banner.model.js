import mongoose from 'mongoose';

/**
 * Banner Model
 * Manages banner images for the application
 */
const bannerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Attachment URL or path (stored after file upload)
    attachment: {
      type: String,
      required: true,
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

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes
bannerSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Banner', bannerSchema);

