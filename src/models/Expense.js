const mongoose = require('mongoose');

// ─── GST HSN Code suggestions (subset) ───────────────────────────────────────
// Used by the system to auto-suggest rates — not stored in DB
const GST_RATES = [0, 5, 12, 18, 28];

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
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'material', 'labor', 'misc',            // legacy (kept valid)
          'civil', 'structural', 'electrical',
          'plumbing', 'finishing', 'equipment',
        ],
        message: 'Invalid category value',
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

    // ─── GST Fields ───────────────────────────────────────────────────────────
    gstRate: {
      type: Number,
      default: 0,
      enum: {
        values: [0, 5, 12, 18, 28],
        message: 'GST rate must be 0, 5, 12, 18, or 28',
      },
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: [0, 'GST amount cannot be negative'],
    },
    cgst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    igst: {
      type: Number,
      default: 0,
    },
    hsnCode: {
      type: String,
      trim: true,
      default: '',
      maxlength: [8, 'HSN code cannot exceed 8 characters'],
    },
    supplyType: {
      type: String,
      enum: {
        values: ['intrastate', 'interstate'],
        message: 'Supply type must be intrastate or interstate',
      },
      default: 'intrastate',
    },
    itcEligible: {
      type: Boolean,
      default: true,
    },
    itcClaimed: {
      type: Boolean,
      default: false,
    },
    vendorGstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: [15, 'GSTIN cannot exceed 15 characters'],
    },

    // ─── Org scoping ──────────────────────────────────────────────────────────
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

// ─── Pre-save: auto-compute GST amounts ──────────────────────────────────────
expenseSchema.pre('save', function (next) {
  if (this.gstRate > 0 && this.amount > 0) {
    this.gstAmount = parseFloat(((this.amount * this.gstRate) / 100).toFixed(2));
    if (this.supplyType === 'intrastate') {
      this.cgst = parseFloat((this.gstAmount / 2).toFixed(2));
      this.sgst = parseFloat((this.gstAmount / 2).toFixed(2));
      this.igst = 0;
    } else {
      this.igst = this.gstAmount;
      this.cgst = 0;
      this.sgst = 0;
    }
  } else {
    this.gstAmount = 0;
    this.cgst = 0;
    this.sgst = 0;
    this.igst = 0;
  }
  next();
});

expenseSchema.index({ siteId: 1 });
expenseSchema.index({ siteId: 1, category: 1 });
expenseSchema.index({ siteId: 1, status: 1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ itcEligible: 1, itcClaimed: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
