import mongoose from 'mongoose';

const TICKET_CATEGORIES = [
  'Payment Not Received',
  'Half Payment Received',
  'Commission Issue',
  'Disbursement Delay',
  'Other',
];

const TICKET_STATUSES = [
  'Open',
  'In Progress',
  'Resolved',
  'Escalated to Regional Manager',
  'Escalated to Admin',
];

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    agentName: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: TICKET_CATEGORIES,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    // Optional: Link to a lead (e.g. payment pending for this lead)
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },

    attachment: {
      url: String,
      fileName: String,
      originalName: String,
    },

    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: 'Open',
      index: true,
    },

    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },

    escalationLevel: {
      type: Number,
      default: 1,
      min: 1,
      max: 3,
    },

    assignedRole: {
      type: String,
      enum: ['relationship_manager', 'franchise', 'regional_manager', 'super_admin'],
      default: 'relationship_manager',
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // SLA tracking - working hours only (7 AM - 6 PM)
    slaDeadline: {
      type: Date,
      index: true,
    },

    slaTimerStartedAt: {
      type: Date,
    },

    internalNotes: [
      {
        note: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: String,
  },
  { timestamps: true }
);

ticketSchema.index({ raisedBy: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ status: 1, escalationLevel: 1 });

export const TICKET_CATEGORIES_LIST = TICKET_CATEGORIES;
export const TICKET_STATUSES_LIST = TICKET_STATUSES;
export default mongoose.model('Ticket', ticketSchema);

