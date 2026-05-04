const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: [true, 'Site reference is required'],
    },
    clientName: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      maxlength: [120, 'Client name cannot exceed 120 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    date: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
    },
    milestone: {
      type: String,
      required: [true, 'Milestone is required'],
      trim: true,
      maxlength: [200, 'Milestone cannot exceed 200 characters'],
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ siteId: 1 });
paymentSchema.index({ siteId: 1, date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
