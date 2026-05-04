const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organisation = require('../models/Organisation');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendTokenResponse = (user, org, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: user.orgId || null,
      orgName: org?.name || null,
      inviteCode: org?.inviteCode || null,
    },
  });
};

// ─── Validation ───────────────────────────────────────────────────────────────

const loginValidation = [
  body('email').trim().notEmpty().isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// ─── POST /api/auth/register/org ─────────────────────────────────────────────
// Creates a new Organisation + owner account
router.post('/register/org', [
  body('orgName').trim().notEmpty().withMessage('Organisation name is required').isLength({ max: 120 }),
  body('name').trim().notEmpty().withMessage('Your name is required').isLength({ max: 80 }),
  body('email').trim().notEmpty().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { orgName, name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    }

    // Create org first
    const org = await Organisation.create({ name: orgName });

    // Create owner user linked to org
    const user = await User.create({ name, email, password, role: 'owner', orgId: org._id });

    sendTokenResponse(user, org, 201, res);
  } catch (err) {
    console.error('Org register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ─── POST /api/auth/register/admin ───────────────────────────────────────────
// Admin joins an existing org using invite code
router.post('/register/admin', [
  body('inviteCode').trim().notEmpty().withMessage('Invite code is required'),
  body('name').trim().notEmpty().withMessage('Your name is required').isLength({ max: 80 }),
  body('email').trim().notEmpty().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { inviteCode, name, email, password } = req.body;

    const org = await Organisation.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!org) {
      return res.status(404).json({ success: false, message: 'Invalid invite code. Please check with your organisation owner.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    }

    const user = await User.create({ name, email, password, role: 'admin', orgId: org._id });

    sendTokenResponse(user, org, 201, res);
  } catch (err) {
    console.error('Admin register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ─── POST /api/auth/members ───────────────────────────────────────────────────
// Owner/Admin creates a member account — members CANNOT self-register
router.post('/members', protect, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
  body('email').trim().notEmpty().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  // Only owner or admin can create members
  if (!['owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Only owners and admins can add members.' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, password } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(400).json({ success: false, message: 'Your account is not linked to an organisation.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    }

    const member = await User.create({ name, email, password, role: 'member', orgId });

    res.status(201).json({
      success: true,
      member: { id: member._id, name: member.name, email: member.email, role: member.role },
    });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ success: false, message: 'Server error while adding member.' });
  }
});

// ─── GET /api/auth/members ────────────────────────────────────────────────────
// List all members of the org
router.get('/members', protect, async (req, res) => {
  if (!['owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  try {
    const members = await User.find({ orgId: req.user.orgId, role: 'member' })
      .select('name email role createdAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: members });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch members.' });
  }
});

// ─── DELETE /api/auth/members/:id ─────────────────────────────────────────────
router.delete('/members/:id', protect, async (req, res) => {
  if (!['owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  try {
    const member = await User.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId, role: 'member' });
    if (!member) return res.status(404).json({ success: false, message: 'Member not found.' });
    res.json({ success: true, message: 'Member removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove member.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const org = user.orgId ? await Organisation.findById(user.orgId) : null;

    sendTokenResponse(user, org, 200, res);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  const org = req.user.orgId ? await Organisation.findById(req.user.orgId) : null;
  res.json({
    success: true,
    user: {
      ...req.user.toJSON(),
      orgName: org?.name || null,
      inviteCode: org?.inviteCode || null,
    },
  });
});

module.exports = router;
