import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const agentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      index: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ['agent'],
      default: 'agent',
    },

    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise',
      required: true,
    },

    commissionPercentage: {
      type: Number,
      default: 0,
    },

    kyc: {
      pan: String,
      aadhaar: String,
      gst: String,
      verified: {
        type: Boolean,
        default: false,
      },
    },

    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifsc: String,
      bankName: String,
    },

    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active',
    },

    city: {
      type: String,
      required: false,
      trim: true,
    },

    lastLoginAt: Date,
  },
  { timestamps: true }
);

// Hash password before saving
agentSchema.pre('save', async function (next) {
  if(!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
})

// Compare password method
agentSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('Agent', agentSchema);
