const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Site = require('../models/Site');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Members can only GET and POST — no edit or delete
router.use((req, res, next) => {
  if (req.user.role === 'member' && (req.method === 'PUT' || req.method === 'DELETE')) {
    return res.status(403).json({ success: false, message: 'Access denied. Members can only view and add expenses.' });
  }
  next();
});

// ─── Validation ───────────────────────────────────────────────────────────────

const expenseBodyValidation = [
  body('siteId').notEmpty().withMessage('siteId is required').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('siteId must be a valid ObjectId'),
  body('name').trim().notEmpty().withMessage('Expense name is required').isLength({ max: 200 }),
  body('vendor').trim().notEmpty().withMessage('Vendor is required').isLength({ max: 120 }),
  body('category').notEmpty().withMessage('Category is required').isIn(['material', 'labor', 'misc']),
  body('amount').notEmpty().withMessage('Amount is required').isFloat({ min: 0 }),
  body('date').optional().isISO8601(),
  body('status').optional().isIn(['paid', 'pending']),
];

const idParam = [
  param('id').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid expense ID'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/expenses — scoped to org
router.get('/', [
  query('siteId').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('siteId must be a valid ObjectId'),
  query('category').optional().isIn(['material', 'labor', 'misc']),
  query('status').optional().isIn(['paid', 'pending']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const filter = { orgId: req.user.orgId };
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
});

// POST /api/expenses — scoped to org
router.post('/', expenseBodyValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const { siteId, name, vendor, category, amount, date, status } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) return res.status(400).json({ success: false, message: 'Your account is not linked to an organisation.' });

    // Verify site belongs to same org
    const site = await Site.findOne({ _id: siteId, orgId });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found in your organisation.' });

    const expense = await Expense.create({ siteId, name, vendor, category, amount, date, status, orgId });
    const populated = await expense.populate('siteId', 'code name cover');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /expenses error:', err);
    res.status(500).json({ success: false, message: 'Failed to create expense.' });
  }
});

// PUT /api/expenses/:id — scoped to org
router.put('/:id', [
  ...idParam,
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('vendor').optional().trim().notEmpty().isLength({ max: 120 }),
  body('category').optional().isIn(['material', 'labor', 'misc']),
  body('amount').optional().isFloat({ min: 0 }),
  body('date').optional().isISO8601(),
  body('status').optional().isIn(['paid', 'pending']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const allowedFields = ['name', 'vendor', 'category', 'amount', 'date', 'status'];
    const updates = {};
    allowedFields.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('siteId', 'code name cover');

    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    res.json({ success: true, data: expense });
  } catch (err) {
    console.error('PUT /expenses/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update expense.' });
  }
});

// DELETE /api/expenses/:id — scoped to org
router.delete('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('DELETE /expenses/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete expense.' });
  }
});

module.exports = router;
