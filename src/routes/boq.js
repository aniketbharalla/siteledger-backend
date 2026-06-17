const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const BOQ = require('../models/BOQ');
const Site = require('../models/Site');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Members cannot access BOQ
router.use((req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ success: false, message: 'Access denied. Members cannot access BOQ data.' });
  }
  next();
});

const idParam = [
  param('id').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid BOQ ID'),
];

// ─── GET /api/boq — list all BOQs for org (optionally filter by siteId) ───────
router.get('/', [
  query('siteId').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid siteId'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const filter = { orgId: req.user.orgId };
    if (req.query.siteId) filter.siteId = req.query.siteId;

    const boqs = await BOQ.find(filter)
      .populate('siteId', 'code name location projectType cover')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: boqs.length, data: boqs });
  } catch (err) {
    console.error('GET /boq error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve BOQs.' });
  }
});

// ─── GET /api/boq/:id — single BOQ ───────────────────────────────────────────
router.get('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const boq = await BOQ.findOne({ _id: req.params.id, orgId: req.user.orgId })
      .populate('siteId', 'code name location projectType cover');
    if (!boq) return res.status(404).json({ success: false, message: 'BOQ not found.' });
    res.json({ success: true, data: boq });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve BOQ.' });
  }
});

// ─── POST /api/boq — create new BOQ ──────────────────────────────────────────
router.post('/', [
  body('siteId').notEmpty().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Valid siteId is required'),
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('projectType').optional().isIn(['building', 'road', 'bridge', 'canal', 'interior', 'other']),
  body('status').optional().isIn(['draft', 'active', 'completed']),
  body('items').optional().isArray(),
  body('items.*.srNo').optional().isInt({ min: 1 }),
  body('items.*.description').optional().trim().notEmpty().isLength({ max: 300 }),
  body('items.*.unit').optional().trim().notEmpty().isLength({ max: 20 }),
  body('items.*.quantity').optional().isFloat({ min: 0 }),
  body('items.*.rate').optional().isFloat({ min: 0 }),
  body('items.*.completionPct').optional().isFloat({ min: 0, max: 100 }),
  body('items.*.category').optional().isIn([
    'civil', 'structural', 'electrical', 'plumbing', 'finishing',
    'road', 'earthwork', 'drainage', 'material', 'labor', 'equipment',
    'misc', 'other'
  ]),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const { siteId, title, projectType, status, items, notes } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) return res.status(400).json({ success: false, message: 'Your account is not linked to an organisation.' });

    const site = await Site.findOne({ _id: siteId, orgId });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found in your organisation.' });

    const boq = await BOQ.create({
      siteId,
      orgId,
      title,
      projectType: projectType || site.projectType || 'building',
      status: status || 'draft',
      items: items || [],
      notes: notes || '',
    });

    const populated = await boq.populate('siteId', 'code name location projectType cover');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /boq error:', err);
    res.status(500).json({ success: false, message: 'Failed to create BOQ.' });
  }
});

// ─── PUT /api/boq/:id — update BOQ (title, status, items, notes) ─────────────
router.put('/:id', [
  ...idParam,
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('projectType').optional().isIn(['building', 'road', 'bridge', 'canal', 'interior', 'other']),
  body('status').optional().isIn(['draft', 'active', 'completed']),
  body('items').optional().isArray(),
  body('notes').optional().trim().isLength({ max: 1000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const allowed = ['title', 'projectType', 'status', 'items', 'notes'];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const boq = await BOQ.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('siteId', 'code name location projectType cover');

    if (!boq) return res.status(404).json({ success: false, message: 'BOQ not found.' });
    res.json({ success: true, data: boq });
  } catch (err) {
    console.error('PUT /boq/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update BOQ.' });
  }
});

// ─── PATCH /api/boq/:id/item/:itemId/completion — update item completion % ───
router.patch('/:id/item/:itemId/completion', [
  ...idParam,
  param('itemId').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid item ID'),
  body('completionPct').isFloat({ min: 0, max: 100 }).withMessage('completionPct must be 0–100'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const boq = await BOQ.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId, 'items._id': req.params.itemId },
      { $set: { 'items.$.completionPct': req.body.completionPct } },
      { new: true }
    ).populate('siteId', 'code name location projectType cover');

    if (!boq) return res.status(404).json({ success: false, message: 'BOQ or item not found.' });
    res.json({ success: true, data: boq });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update item completion.' });
  }
});

// ─── DELETE /api/boq/:id ─────────────────────────────────────────────────────
router.delete('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const boq = await BOQ.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!boq) return res.status(404).json({ success: false, message: 'BOQ not found.' });
    res.json({ success: true, message: 'BOQ deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete BOQ.' });
  }
});

module.exports = router;
