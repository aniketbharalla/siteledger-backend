const express = require('express');
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Site = require('../models/Site');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// ─── Validation ───────────────────────────────────────────────────────────────

const paymentBodyValidation = [
  body('siteId')
    .notEmpty().withMessage('siteId is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('siteId must be a valid ObjectId'),
  body('clientName')
    .trim()
    .notEmpty().withMessage('Client name is required')
    .isLength({ max: 120 }).withMessage('Client name cannot exceed 120 characters'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0 }).withMessage('Amount must be a non-negative number'),
  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('milestone')
    .trim()
    .notEmpty().withMessage('Milestone is required')
    .isLength({ max: 200 }).withMessage('Milestone cannot exceed 200 characters'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/payments?siteId=xxx
 * List client payments, optionally filtered by site.
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

      const payments = await Payment.find(filter)
        .populate('siteId', 'code name cover')
        .sort({ date: -1 });

      res.json({ success: true, count: payments.length, data: payments });
    } catch (err) {
      console.error('GET /payments error:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve payments.' });
    }
  }
);

/**
 * POST /api/payments
 * Record a new client payment.
 */
router.post('/', paymentBodyValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { siteId, clientName, amount, date, milestone } = req.body;

    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ success: false, message: 'Referenced site not found.' });
    }

    const payment = await Payment.create({ siteId, clientName, amount, date, milestone });
    const populated = await payment.populate('siteId', 'code name cover');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /payments error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment.' });
  }
});

module.exports = router;
