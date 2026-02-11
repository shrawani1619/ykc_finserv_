import mongoose from 'mongoose';
import './agent.model.js';

/**
 Acciojob
 work exp
 crm dashboard
 event management exp
 */
const leadSchema = new mongoose.Schema(
  {
    // Applicant details
    applicantMobile: {
      type: String,
      index: true,   
    },

    applicantEmail: String,

    // Loan details
    loanType: {
      type: String,
      enum: ['personal_loan', 'home_loan', 'business_loan',
         'loan_against_property', 'education_loan', 'car_loan', 'gold_loan'],
      required: true,
    },

    loanAmount: {
      type: Number,
      required: true,
    },
    
    loanAccountNo: {
      type: String,
      required: true,
      index: true,
    },

    // References
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Changed from 'Agent' to 'User' since agents are now stored in User model
      required: true,
      index: true,
    },
    
    // (No direct franchise field — use polymorphic `associated` + `associatedModel`)

    // Polymorphic association: can be a Franchise or a RelationshipManager
    associated: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'associatedModel',
      index: true,
    },
    associatedModel: {
      type: String,
      enum: ['Franchise', 'RelationshipManager'],
      index: true,
    },

    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: true,
      index: true,
    },

    // Case status workflow
    status: {
      type: String,
      enum: [
        'logged',
        'sanctioned',
        'partial_disbursed',
        'disbursed',
        'completed',
        'rejected',
      ],
      default: 'logged',
      index: true,
    },

    // Sanction and disbursement details
    sanctionedDate: Date,

    disbursedAmount: {
      type: Number,
      default: 0,
    },

    disbursementDate: Date,

    disbursementType: {
      type: String,
      enum: ['full', 'partial'],
    },

    // Disbursement history for partial disbursements
    disbursementHistory: [
      {
        amount: Number,
        date: Date,
        type: {
          type: String,
          enum: ['full', 'partial'],
        },
        remarks: String,
      },
    ],

    // Commission details
    commissionBasis: {
      type: String,
      enum: ['sanctioned', 'disbursed'],
    },

    commissionPercentage: {
      type: Number,
      default: 0,
    },

    // Verification workflow
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    verifiedAt: Date,

    // Invoice reference
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },

    isInvoiceGenerated: {
      type: Boolean,
      default: false,
    },

    // Additional details
    remarks: String,

    // Bank coordination
    sentToBankAt: Date,
    bankResponseReceivedAt: Date,

    // Customer Details Form
    customerName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    
    // SM/BM can be either a Staff (login-able) or a BankManager (contact-only).
    // Use polymorphic ref to support both.
    smBm: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'smBmModel',
      index: true,
    },
    smBmModel: {
      type: String,
      enum: ['Staff', 'BankManager'],
      index: true,
    },
    smBmEmail: String,
    smBmMobile: String,

    asmName: String,
    asmEmail: String,
    asmMobile: String,
    
    dsaCode: String,
    branch: String,
  },
  { timestamps: true }
);

// Indexes for efficient queries
leadSchema.index({ agent: 1, status: 1 });
leadSchema.index({ associated: 1, status: 1 });
leadSchema.index({ associatedModel: 1, status: 1 });
leadSchema.index({ bank: 1, status: 1 });
leadSchema.index({ verificationStatus: 1 });

export default mongoose.model('Lead', leadSchema);
