import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    mobile: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but enforce uniqueness for non-null values
    },

    phone: {
      type: String,
      sparse: true, // Allow null values but enforce uniqueness for non-null values
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ['staff', 'accounts', 'franchise_manager', 'admin'],
      required: true,
    },

    department: {
      type: String,
      enum: ['Operations', 'Finance', 'Customer Service', 'HR', 'IT', 'Sales', 'Marketing'],
    },

    salary: {
      type: Number,
      default: 0,
      min: 0,
    },

    permissions: [String], // optional granular access

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    lastLoginAt: Date,
  },
  { timestamps: true }
);

// Hash password before saving
staffSchema.pre('save', async function(next){
  if(!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
})

// Compare password method
staffSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('Staff', staffSchema);
