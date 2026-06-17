const express = require('express');
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Site = require('../models/Site');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Members cannot access site data
router.use((req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ success: false, message: 'Access denied. Members cannot access site data.' });
  }
  next();
});

// ─── Validation ───────────────────────────────────────────────────────────────

const siteBodyValidation = [
  body('code').optional({ checkFalsy: true }).trim().toUpperCase().isLength({ max: 10 }).withMessage('Site code cannot exceed 10 characters'),
  body('name').trim().notEmpty().withMessage('Site name is required').isLength({ max: 120 }),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('projectType').optional().isIn(['building', 'road', 'bridge', 'canal', 'interior', 'other']).withMessage('Invalid project type'),
  body('status').optional().isIn(['active', 'completed']).withMessage('Status must be "active" or "completed"'),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  body('expectedEndDate').optional({ checkFalsy: true }).isISO8601().withMessage('Expected end date must be a valid ISO 8601 date'),
  body('completionPct').optional().isFloat({ min: 0, max: 100 }).withMessage('Completion must be 0–100'),
  body('totalBudget').notEmpty().withMessage('Total budget is required').isFloat({ min: 0 }),
  body('cover').optional().trim(),
];

const idParam = [
  param('id').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid site ID'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/sites — only sites belonging to the user's org
router.get('/', async (req, res) => {
  try {
    const sites = await Site.find({ orgId: req.user.orgId }).sort({ startDate: -1 });
    res.json({ success: true, count: sites.length, data: sites });
  } catch (err) {
    console.error('GET /sites error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve sites.' });
  }
});

// POST /api/sites — create site scoped to user's org
router.post('/', siteBodyValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const { code, name, location, status, startDate, totalBudget, cover } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) return res.status(400).json({ success: false, message: 'Your account is not linked to an organisation.' });

    const siteCode = code || `SITE-${Date.now()}`;

    // Check uniqueness within the org only
    const existing = await Site.findOne({ code: siteCode, orgId });
    if (existing) return res.status(409).json({ success: false, message: `A site with code "${siteCode}" already exists in your organisation.` });

    const site = await Site.create({
      code: siteCode,
      name,
      location,
      status: status || 'active',
      startDate: startDate || new Date(),
      totalBudget,
      cover,
      orgId,
    });

    res.status(201).json({ success: true, data: site });
  } catch (err) {
    console.error('POST /sites error:', err);
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Site code must be unique.' });
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message).join(', ');
      return res.status(422).json({ success: false, message: messages });
    }
    res.status(500).json({ success: false, message: err.message || 'Failed to create site.' });
  }
});

// GET /api/sites/:id — only if belongs to user's org
router.get('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const site = await Site.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found.' });
    res.json({ success: true, data: site });
  } catch (err) {
    console.error('GET /sites/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve site.' });
  }
});

// PUT /api/sites/:id — only if belongs to user's org
router.put('/:id', [
  ...idParam,
  body('code').optional().trim().toUpperCase().isLength({ max: 10 }),
  body('name').optional().trim().notEmpty().isLength({ max: 120 }),
  body('location').optional().trim().notEmpty(),
  body('projectType').optional().isIn(['building', 'road', 'bridge', 'canal', 'interior', 'other']),
  body('status').optional().isIn(['active', 'completed']),
  body('startDate').optional().isISO8601(),
  body('expectedEndDate').optional({ checkFalsy: true }).isISO8601(),
  body('completionPct').optional().isFloat({ min: 0, max: 100 }),
  body('totalBudget').optional().isFloat({ min: 0 }),
  body('cover').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const allowedFields = ['code', 'name', 'location', 'projectType', 'status', 'startDate', 'expectedEndDate', 'completionPct', 'totalBudget', 'cover'];
    const updates = {};
    allowedFields.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    const site = await Site.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!site) return res.status(404).json({ success: false, message: 'Site not found.' });
    res.json({ success: true, data: site });
  } catch (err) {
    console.error('PUT /sites/:id error:', err);
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Site code must be unique.' });
    res.status(500).json({ success: false, message: 'Failed to update site.' });
  }
});

// DELETE /api/sites/:id — only if belongs to user's org
router.delete('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const site = await Site.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found.' });
    res.json({ success: true, message: 'Site deleted successfully.' });
  } catch (err) {
    console.error('DELETE /sites/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete site.' });
  }
});

module.exports = router;
