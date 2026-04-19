const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Site = require('../models/Site');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// ─── Validation ───────────────────────────────────────────────────────────────

const expenseBodyValidation = [
  body('siteId')
    .notEmpty().withMessage('siteId is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('siteId must be a valid ObjectId'),
  body('name')
    .trim()
    .notEmpty().withMessage('Expense name is required')
    .isLength({ max: 200 }).withMessage('Name cannot exceed 200 characters'),
  body('vendor')
    .trim()
    .notEmpty().withMessage('Vendor is required')
    .isLength({ max: 120 }).withMessage('Vendor cannot exceed 120 characters'),
  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(['material', 'labor', 'misc']).withMessage('Category must be "material", "labor", or "misc"'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0 }).withMessage('Amount must be a non-negative number'),
  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('status')
    .optional()
    .isIn(['paid', 'pending']).withMessage('Status must be "paid" or "pending"'),
];

const idParam = [
  param('id')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid expense ID'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/expenses?siteId=xxx&category=material&status=paid
 * List expenses with optional filters; ordered newest first.
 */
router.get(
  '/',
  [
    query('siteId')
      .optional()
      .custom((v) => mongoose.Types.ObjectId.isValid(v))
      .withMessage('siteId must be a valid ObjectId'),
    query('category')
      .optional()
      .isIn(['material', 'labor', 'misc'])
      .withMessage('category must be "material", "labor", or "misc"'),
    query('status')
      .optional()
      .isIn(['paid', 'pending'])
      .withMessage('status must be "paid" or "pending"'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const filter = {};
      if (req.query.siteId) filter.siteId = req.query.siteId;
      if (req.query.category) filter.category = req.query.category;
      if (req.query.status) filter.status = req.query.status;

      const expenses = await Expense.find(filter)
        .populate('siteId', 'code name cover')
        .sort({ date: -1 });

      res.json({ success: true, count: expenses.length, data: expenses });
    } catch (err) {
      console.error('GET /expenses error:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve expenses.' });
    }
  }
);

/**
 * POST /api/expenses
 * Create a new expense.
 */
router.post('/', expenseBodyValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { siteId, name, vendor, category, amount, date, status } = req.body;

    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ success: false, message: 'Referenced site not found.' });
    }

    const expense = await Expense.create({ siteId, name, vendor, category, amount, date, status });
    const populated = await expense.populate('siteId', 'code name cover');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /expenses error:', err);
    res.status(500).json({ success: false, message: 'Failed to create expense.' });
  }
});

/**
 * PUT /api/expenses/:id
 * Partial update of an expense (e.g. mark as paid).
 */
router.put(
  '/:id',
  [
    ...idParam,
    body('name').optional().trim().notEmpty().isLength({ max: 200 }),
    body('vendor').optional().trim().notEmpty().isLength({ max: 120 }),
    body('category').optional().isIn(['material', 'labor', 'misc']),
    body('amount').optional().isFloat({ min: 0 }),
    body('date').optional().isISO8601(),
    body('status').optional().isIn(['paid', 'pending']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const allowedFields = ['name', 'vendor', 'category', 'amount', 'date', 'status'];
      const updates = {};
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      const expense = await Expense.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('siteId', 'code name cover');

      if (!expense) {
        return res.status(404).json({ success: false, message: 'Expense not found.' });
      }

      res.json({ success: true, data: expense });
    } catch (err) {
      console.error('PUT /expenses/:id error:', err);
      res.status(500).json({ success: false, message: 'Failed to update expense.' });
    }
  }
);

/**
 * DELETE /api/expenses/:id
 * Permanently delete an expense record.
 */
router.delete('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }
    res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('DELETE /expenses/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete expense.' });
  }
});

module.exports = router;
