const express = require('express');
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Members cannot access vendor data
router.use((req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  next();
});

const idParam = [
  param('id').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid vendor ID'),
];

const vendorBodyValidation = [
  body('name').trim().notEmpty().withMessage('Vendor name is required').isLength({ max: 120 }),
  body('category').optional().isIn(['material', 'labor', 'subcontract', 'equipment', 'other']),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('email').optional().trim().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('gstin').optional().trim().isLength({ max: 15 }),
  body('address').optional().trim().isLength({ max: 400 }),
  body('notes').optional().trim().isLength({ max: 500 }),
];

// GET /api/vendors
router.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find({ orgId: req.user.orgId }).sort({ name: 1 });
    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve vendors.' });
  }
});

// POST /api/vendors
router.post('/', vendorBodyValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const { name, category, phone, email, gstin, address, notes } = req.body;
    const orgId = req.user.orgId;
    if (!orgId) return res.status(400).json({ success: false, message: 'Not linked to an organisation.' });

    const vendor = await Vendor.create({ orgId, name, category, phone, email, gstin, address, notes });
    res.status(201).json({ success: true, data: vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create vendor.' });
  }
});

// PUT /api/vendors/:id
router.put('/:id', [...idParam, ...vendorBodyValidation], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const allowed = ['name', 'category', 'phone', 'email', 'gstin', 'address', 'notes'];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const vendor = await Vendor.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    res.json({ success: true, data: vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update vendor.' });
  }
});

// DELETE /api/vendors/:id
router.delete('/:id', idParam, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const vendor = await Vendor.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    res.json({ success: true, message: 'Vendor deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete vendor.' });
  }
});

module.exports = router;
