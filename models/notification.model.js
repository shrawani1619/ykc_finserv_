import mongoose from 'mongoose';

/**
 * Notification Model
 * Stores system notifications for users
 */
const notificationSchema = new mongoose.Schema(
  {
    // User who should receive this notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Notification details
    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    // Notification type: info, success, warning, error
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
      index: true,
    },

    // Read status
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: Date,

    // Related entity (optional)
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,

    // Additional data
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
