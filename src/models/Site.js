const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Site code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Site code cannot exceed 10 characters'],
    },
    name: {
      type: String,
      required: [true, 'Site name is required'],
      trim: true,
      maxlength: [120, 'Site name cannot exceed 120 characters'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'completed'],
        message: 'Status must be either "active" or "completed"',
      },
      default: 'active',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    totalBudget: {
      type: Number,
      required: [true, 'Total budget is required'],
      min: [0, 'Budget cannot be negative'],
    },
    cover: {
      type: String,
      default: 'oklch(0.62 0.08 220)',
      trim: true,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for common queries
siteSchema.index({ status: 1 });

module.exports = mongoose.model('Site', siteSchema);
