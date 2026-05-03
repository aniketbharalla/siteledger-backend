const mongoose = require('mongoose');

const investorSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: [true, 'Site reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Investor name is required'],
      trim: true,
      maxlength: [120, 'Investor name cannot exceed 120 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Investment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    share: {
      type: Number,
      default: 0,
      min: [0, 'Share cannot be negative'],
      max: [100, 'Share cannot exceed 100%'],
    },
    date: {
      type: Date,
      required: [true, 'Investment date is required'],
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

investorSchema.index({ siteId: 1 });
investorSchema.index({ siteId: 1, name: 1 });

module.exports = mongoose.model('Investor', investorSchema);
