const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: [true, 'Site reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Expense name is required'],
      trim: true,
      maxlength: [200, 'Expense name cannot exceed 200 characters'],
    },
    vendor: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
      maxlength: [120, 'Vendor name cannot exceed 120 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['material', 'labor', 'misc'],
        message: 'Category must be "material", "labor", or "misc"',
      },
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    date: {
      type: Date,
      required: [true, 'Expense date is required'],
      default: Date.now,
    },
    status: {
      type: String,
      enum: {
        values: ['paid', 'pending'],
        message: 'Status must be "paid" or "pending"',
      },
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({ siteId: 1 });
expenseSchema.index({ siteId: 1, category: 1 });
expenseSchema.index({ siteId: 1, status: 1 });
expenseSchema.index({ date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
