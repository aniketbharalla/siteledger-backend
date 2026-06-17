const mongoose = require('mongoose');

const boqItemSchema = new mongoose.Schema({
  srNo: { type: Number, required: true },
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true,
    maxlength: [300, 'Description cannot exceed 300 characters'],
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Unit cannot exceed 20 characters'],
    // e.g. CUM, SQM, RM, NOS, LSUM, KG, MT, CFT
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
  },
  rate: {
    type: Number,
    required: [true, 'Rate is required'],
    min: [0, 'Rate cannot be negative'],
  },
  amount: {
    type: Number,
    default: 0, // auto-computed: quantity × rate
  },
  completionPct: {
    type: Number,
    default: 0,
    min: [0, 'Completion cannot be negative'],
    max: [100, 'Completion cannot exceed 100%'],
  },
  category: {
    type: String,
    enum: {
      values: [
        'civil', 'structural', 'electrical', 'plumbing', 'finishing',
        'road', 'earthwork', 'drainage', 'material', 'labor', 'equipment',
        'misc', 'other'
      ],
      message: 'Invalid item category',
    },
    default: 'civil',
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    default: '',
  },
}, { _id: true });

const boqSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: [true, 'Site reference is required'],
      index: true,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'BOQ title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    projectType: {
      type: String,
      enum: {
        values: ['building', 'road', 'bridge', 'canal', 'interior', 'other'],
        message: 'Invalid project type',
      },
      default: 'building',
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'completed'],
        message: 'Status must be draft, active, or completed',
      },
      default: 'draft',
    },
    items: [boqItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ─── Pre-save: auto-compute item amounts and BOQ total ────────────────────────
boqSchema.pre('save', function (next) {
  let total = 0;
  this.items.forEach((item) => {
    item.amount = parseFloat((item.quantity * item.rate).toFixed(2));
    total += item.amount;
  });
  this.totalAmount = parseFloat(total.toFixed(2));
  next();
});

boqSchema.index({ siteId: 1, status: 1 });

module.exports = mongoose.model('BOQ', boqSchema);
