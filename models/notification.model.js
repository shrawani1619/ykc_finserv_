import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      default: '',
    },

    relatedTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      index: true,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    type: {
      type: String,
      enum: ['ticket_assigned', 'ticket_escalated', 'ticket_resolved', 'ticket_reassigned'],
      default: 'ticket_assigned',
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);

