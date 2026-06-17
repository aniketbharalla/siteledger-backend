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
    invoiceNo: {
      type: String,
      trim: true,
      default: '',
      maxlength: [50, 'Invoice number cannot exceed 50 characters'],
    },

    // ─── Output GST Fields ────────────────────────────────────────────────────
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
      default: '9954',  // default: construction works contract
      maxlength: [8, 'HSN/SAC code cannot exceed 8 characters'],
    },
    placeOfSupply: {
      type: String,
      trim: true,
      default: '',
      maxlength: [50, 'Place of supply cannot exceed 50 characters'],
    },
    supplyType: {
      type: String,
      enum: {
        values: ['intrastate', 'interstate'],
        message: 'Supply type must be intrastate or interstate',
      },
      default: 'intrastate',
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

// ─── Pre-save: auto-compute output GST amounts ───────────────────────────────
paymentSchema.pre('save', function (next) {
  if (this.gstRate > 0 && this.amount > 0) {
    // amount is BASE amount (excl. GST)
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

paymentSchema.index({ siteId: 1 });
paymentSchema.index({ siteId: 1, date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
