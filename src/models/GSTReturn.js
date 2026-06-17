const mongoose = require('mongoose');

const gstReturnSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true,
    },
    returnType: {
      type: String,
      enum: {
        values: ['GSTR1', 'GSTR3B', 'GSTR2B'],
        message: 'Return type must be GSTR1, GSTR3B, or GSTR2B',
      },
      required: true,
    },
    // Period in "YYYY-MM" format e.g. "2024-06" for June 2024
    period: {
      type: String,
      required: [true, 'Period is required'],
      match: [/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    filedDate: {
      type: Date,
      default: null, // null = not yet filed
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'filed', 'late'],
        message: 'Status must be pending, filed, or late',
      },
      default: 'pending',
    },
    totalOutput: {
      type: Number,
      default: 0,
    },
    totalITC: {
      type: Number,
      default: 0,
    },
    netPayable: {
      type: Number,
      default: 0,
    },
    challanNo: {
      type: String,
      trim: true,
      default: '',
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

// Compound index to prevent duplicate return entries per org/period/type
gstReturnSchema.index({ orgId: 1, period: 1, returnType: 1 }, { unique: true });
gstReturnSchema.index({ orgId: 1, status: 1 });
gstReturnSchema.index({ dueDate: 1 });

module.exports = mongoose.model('GSTReturn', gstReturnSchema);
