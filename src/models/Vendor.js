const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
      maxlength: [120, 'Vendor name cannot exceed 120 characters'],
    },
    category: {
      type: String,
      enum: {
        values: ['material', 'labor', 'subcontract', 'equipment', 'other'],
        message: 'Category must be material, labor, subcontract, equipment, or other',
      },
      default: 'material',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [20, 'Phone cannot exceed 20 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: [120, 'Email cannot exceed 120 characters'],
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: [15, 'GSTIN cannot exceed 15 characters'],
    },
    address: {
      type: String,
      trim: true,
      default: '',
      maxlength: [400, 'Address cannot exceed 400 characters'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

vendorSchema.index({ orgId: 1, name: 1 });
vendorSchema.index({ orgId: 1, category: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
