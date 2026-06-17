const mongoose = require('mongoose');

const gstProfileSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      unique: true, // one GST profile per org
      index: true,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: [15, 'GSTIN cannot exceed 15 characters'],
      // e.g. 27AABCU9603R1ZX
    },
    legalName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Legal name cannot exceed 200 characters'],
    },
    tradeName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Trade name cannot exceed 200 characters'],
    },
    registrationType: {
      type: String,
      enum: {
        values: ['regular', 'qrmp', 'composition', 'unregistered'],
        message: 'Registration type must be regular, qrmp, composition, or unregistered',
      },
      default: 'regular',
    },
    filingFrequency: {
      type: String,
      enum: {
        values: ['monthly', 'quarterly'],
        message: 'Filing frequency must be monthly or quarterly',
      },
      default: 'monthly',
    },
    stateCode: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2, 'State code is 2 digits (e.g. 27 for Maharashtra)'],
    },
    stateName: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: [10, 'PAN cannot exceed 10 characters'],
    },
    // Financial year start month (April = 4 for India)
    fyStartMonth: {
      type: Number,
      default: 4,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GSTProfile', gstProfileSchema);
