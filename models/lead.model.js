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
    // Case/Lead identification
    caseNumber: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },

    // Lead type
    leadType: {
      type: String,
      enum: ['fresh', 'disbursed'],
      required: true,
      default: 'fresh',
    },

    // Applicant details
    applicantMobile: {
      type: String,
      required: true,
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

    loanAccountNo: String,

    // References
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Changed from 'Agent' to 'User' since agents are now stored in User model
      required: true,
      index: true,
    },

    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise',
      required: true,
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
    sanctionedAmount: Number,
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
    customerName: String,
    
    smBm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      index: true,
    },
    
    smBmEmail: String,
    smBmMobile: String,
    
    asmName: String,
    asmEmail: String,
    asmMobile: String,
    
    codeUse: String,
    branch: String,
  },
  { timestamps: true }
);

// Indexes for efficient queries
leadSchema.index({ agent: 1, status: 1 });
leadSchema.index({ franchise: 1, status: 1 });
leadSchema.index({ bank: 1, status: 1 });
leadSchema.index({ verificationStatus: 1 });
leadSchema.index({ leadType: 1 });

export default mongoose.model('Lead', leadSchema);
