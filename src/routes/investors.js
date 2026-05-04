const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Investor = require('../models/Investor');
const Site = require('../models/Site');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Members cannot access investor data
router.use((req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ success: false, message: 'Access denied. Members cannot access investor data.' });
  }
  next();
});

// ─── Validation ───────────────────────────────────────────────────────────────

const investorBodyValidation = [
  body('siteId').notEmpty().withMessage('siteId is required').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('siteId must be a valid ObjectId'),
  body('name').trim().notEmpty().withMessage('Investor name is required').isLength({ max: 120 }),
  body('amount').notEmpty().withMessage('Amount is required').isFloat({ min: 0 }),
  body('date').optional().isISO8601(),
];

const idParam = [
  param('id').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid investor ID'),
];

// ─── Helper: recalculate share % for all investors of a site ──────────────────
async function recalcShares(siteId) {
  const all = await Investor.find({ siteId });
  const total = all.reduce((s, i) => s + (i.amount || 0), 0);
  if (total === 0) return;
  await Promise.all(
    all.map(inv => {
      const share = parseFloat(((inv.amount / total) * 100).toFixed(4));
      return Investor.findByIdAndUpdate(inv._id, { share });
    })
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/investors — scoped to org
router.get('/', [
  query('siteId').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('siteId must be a valid ObjectId'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const filter = { orgId: req.user.orgId };
    if (req.query.siteId) filter.siteId = req.query.siteId;

    const investors = await Investor.find(filter)
      .populate('siteId', 'code name location status cover')
      .sort({ date: -1 });

    res.json({ success: true, count: investors.length, data: investors });
  } catch (err) {
    console.error('GET /investors error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve investors.' });
  }
});

// POST /api/investors — scoped to org
router.post('/', investorBodyValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const { siteId, name, amount, date } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) return res.status(400).json({ success: false, message: 'Your account is not linked to an organisation.' });

    // Verify site belongs to same org
    const site = await Site.findOne({ _id: siteId, orgId });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found in your organisation.' });

    const investor = await Investor.create({ siteId, name, amount, share: 0, date, orgId });
    await recalcShares(siteId);

    const populated = await Investor.findById(investor._id)
      .populate('siteId', 'code name location status cover');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /investors error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message).join(', ');
      return res.status(422).json({ success: false, message: messages });
    }
    res.status(500).json({ success: false, message: err.message || 'Failed to create investor.' });
  }
});

// PUT /api/investors/:id — scoped to org
router.put('/:id', [
  ...idParam,
  body('name').optional().trim().notEmpty().isLength({ max: 120 }),
  body('siteId').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('siteId must be a valid ObjectId'),
  body('amount').optional().isFloat({ min: 0 }),
  body('date').optional().isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const allowedFields = ['name', 'siteId', 'amount', 'date'];
    const updates = {};
    allowedFields.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    if (updates.siteId) {
      const site = await Site.findOne({ _id: updates.siteId, orgId: req.user.orgId });
      if (!site) return res.status(404).json({ success: false, message: 'Site not found in your organisation.' });
    }

    const investor = await Investor.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found.' });

    await recalcShares(investor.siteId);

    const populated = await Investor.findById(investor._id)
      .populate('siteId', 'code name location status cover');

    res.json({ success: true, data: populated });
  } catch (err) {
    console.error('PUT /investors/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update investor.' });
  }
});

// DELETE /api/investors/:id — scoped to org
router.delete('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const investor = await Investor.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found.' });

    await recalcShares(investor.siteId);

    res.json({ success: true, message: 'Investor deleted successfully.' });
  } catch (err) {
    console.error('DELETE /investors/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete investor.' });
  }
});

module.exports = router;
