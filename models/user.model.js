import mongoose from 'mongoose';

/**
 * Unified User Model
 * Consolidates Agent and Staff into a single user model with role-based access control
 * Supports: super_admin, relationship_manager, franchise_manager, franchise_owner, agent, accounts_manager
 */
const userSchema = new mongoose.Schema(
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

    phone: {
      type: String,
      sparse: true,
    },

    profileImage: {
      type: String,
      default: null,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: [
        'super_admin', 
        'relationship_manager',
        'franchise_manager',
        'franchise_owner',
        'agent',
        'accounts_manager',
      ],
      required: true,
      index: true,
    },

    // Role-specific fields
    // For agents and franchise owners
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise',
      required: function () {
        return ['agent', 'franchise_owner'].includes(this.role);
      },
    },

    // For franchise owners
    franchiseOwned: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise',
      required: function () {
        return this.role === 'franchise_owner';
      },
    },

    // For agents
    commissionPercentage: {
      type: Number,
      default: 0,
    },

    // Permissions array for granular access control
    permissions: {
      type: [String],
      default: [],
    },

    // KYC details (mainly for agents)
    kyc: {
      pan: String,
      aadhaar: String,
      gst: String,
      verified: {
        type: Boolean,
        default: false,
      },
    },

    // Bank details (mainly for agents)
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
      index: true,
    },

    lastLoginAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Index for efficient queries
userSchema.index({ role: 1, status: 1 });
userSchema.index({ franchise: 1, role: 1 });

// Compare password method (supports both plain text and bcrypt hashed passwords)
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) {
    console.log('❌ No password stored for user');
    return false;
  }

  // Check if password is bcrypt hashed (starts with $2a$, $2b$, or $2y$)
  const isHashed = this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$'));
  
  if (isHashed) {
    // Password is hashed, use bcrypt comparison
    console.log('🔐 Comparing bcrypt hashed password');
    const result = await bcrypt.compare(enteredPassword, this.password);
    console.log('🔐 Bcrypt comparison result:', result);
    return result;
  }
  
  // Password is plain text, use direct comparison
  console.log('🔐 Comparing plain text password');
  console.log('🔐 Entered password length:', enteredPassword?.length);
  console.log('🔐 Stored password length:', this.password?.length);
  console.log('🔐 Passwords match:', enteredPassword === this.password);
  return enteredPassword === this.password;
};

// Method to check if user has permission
userSchema.methods.hasPermission = function (permission) {
  if (this.role === 'super_admin') return true;
  return this.permissions.includes(permission);
};

export default mongoose.model('User', userSchema);
