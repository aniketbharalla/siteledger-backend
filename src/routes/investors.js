const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Investor = require('../models/Investor');
const Site = require('../models/Site');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// ─── Validation ───────────────────────────────────────────────────────────────

const investorBodyValidation = [
  body('siteId')
    .notEmpty().withMessage('siteId is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('siteId must be a valid ObjectId'),
  body('name')
    .trim()
    .notEmpty().withMessage('Investor name is required')
    .isLength({ max: 120 }).withMessage('Name cannot exceed 120 characters'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0 }).withMessage('Amount must be a non-negative number'),
  body('share')
    .notEmpty().withMessage('Share percentage is required')
    .isFloat({ min: 0, max: 100 }).withMessage('Share must be between 0 and 100'),
  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid ISO 8601 date'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/investors?siteId=xxx
 * List investors, optionally filtered by siteId.
 */
router.get(
  '/',
  [
    query('siteId')
      .optional()
      .custom((v) => mongoose.Types.ObjectId.isValid(v))
      .withMessage('siteId must be a valid ObjectId'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const filter = {};
      if (req.query.siteId) filter.siteId = req.query.siteId;

      const investors = await Investor.find(filter)
        .populate('siteId', 'code name location status cover')
        .sort({ date: -1 });

      res.json({ success: true, count: investors.length, data: investors });
    } catch (err) {
      console.error('GET /investors error:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve investors.' });
    }
  }
);

/**
 * POST /api/investors
 * Create a new investor record.
 */
router.post('/', investorBodyValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { siteId, name, amount, share, date } = req.body;

    // Verify the referenced site exists
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ success: false, message: 'Referenced site not found.' });
    }

    const investor = await Investor.create({ siteId, name, amount, share, date });
    const populated = await investor.populate('siteId', 'code name location status cover');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /investors error:', err);
    res.status(500).json({ success: false, message: 'Failed to create investor.' });
  }
});

const idParam = [
  param('id')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid investor ID'),
];

/**
 * PUT /api/investors/:id
 * Partial update of an investor record.
 */
router.put(
  '/:id',
  [
    ...idParam,
    body('name').optional().trim().notEmpty().isLength({ max: 120 }),
    body('siteId').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('siteId must be a valid ObjectId'),
    body('amount').optional().isFloat({ min: 0 }),
    body('share').optional().isFloat({ min: 0, max: 100 }),
    body('date').optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const allowedFields = ['name', 'siteId', 'amount', 'share', 'date'];
      const updates = {};
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      if (updates.siteId) {
        const site = await Site.findById(updates.siteId);
        if (!site) return res.status(404).json({ success: false, message: 'Referenced site not found.' });
      }

      const investor = await Investor.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('siteId', 'code name location status cover');

      if (!investor) return res.status(404).json({ success: false, message: 'Investor not found.' });

      res.json({ success: true, data: investor });
    } catch (err) {
      console.error('PUT /investors/:id error:', err);
      res.status(500).json({ success: false, message: 'Failed to update investor.' });
    }
  }
);

/**
 * DELETE /api/investors/:id
 * Permanently delete an investor record.
 */
router.delete('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const investor = await Investor.findByIdAndDelete(req.params.id);
    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found.' });
    res.json({ success: true, message: 'Investor deleted successfully.' });
  } catch (err) {
    console.error('DELETE /investors/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete investor.' });
  }
});

module.exports = router;
