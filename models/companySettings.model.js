import mongoose from 'mongoose';

/**
 * Company Settings Model
 * Stores company information used across the application (e.g., in invoices)
 */
const companySettingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      default: 'YKC finserv PVT. LTD',
    },
    address: {
      type: String,
      required: true,
      default: 'F-3, 3rd Floor, Gangadhar Chambers Co Op Society, Opposite Prabhat Press, Narayan Peth, Pune, Maharashtra 411030',
    },
    gstNo: {
      type: String,
      required: true,
      default: '27AABCY2731J28',
    },
    panNo: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    mobile: {
      type: String,
      required: false,
      default: '9130011700',
    },
    // Bank details for company
    bankDetails: {
      bankName: {
        type: String,
        default: 'STATE BANK OF INDIA',
      },
      accountNumber: {
        type: String,
        default: '43726535738',
      },
      ifsc: {
        type: String,
        default: 'SBIN0018880',
      },
      branch: {
        type: String,
        default: 'TATHAWADE PUNE',
      },
    },
    // Tax configuration
    taxConfig: {
      cgstRate: {
        type: Number,
        default: 9, // 9%
      },
      sgstRate: {
        type: Number,
        default: 9, // 9%
      },
      defaultTdsRate: {
        type: Number,
        default: 2, // 2%
      },
    },
  },
  { timestamps: true }
);

// Ensure only one company settings document exists
companySettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model('CompanySettings', companySettingsSchema);

