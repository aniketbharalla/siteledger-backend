const express = require('express');
const { body, validationResult } = require('express-validator');
const GSTProfile = require('../models/GSTProfile');
const GSTReturn = require('../models/GSTReturn');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Members cannot access GST data
router.use((req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  next();
});

// ─── Helper: compute filing due dates ────────────────────────────────────────

/**
 * Returns GSTR-1 and GSTR-3B due dates for a given period (YYYY-MM)
 * based on registration type.
 */
function getFilingDueDates(period, registrationType = 'regular') {
  const [year, month] = period.split('-').map(Number);
  // next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  if (registrationType === 'qrmp') {
    // Quarterly — due on 13th of month after quarter end
    const quarterEndMonths = [3, 6, 9, 12];
    if (quarterEndMonths.includes(month)) {
      return {
        gstr1Due: new Date(nextYear, nextMonth - 1, 13),
        gstr3bDue: new Date(nextYear, nextMonth - 1, 22),
      };
    }
    // Non quarter-end months: only 3B due
    return {
      gstr1Due: null,
      gstr3bDue: new Date(nextYear, nextMonth - 1, 22),
    };
  }

  // Regular / default
  return {
    gstr1Due: new Date(nextYear, nextMonth - 1, 11),
    gstr3bDue: new Date(nextYear, nextMonth - 1, 20),
  };
}

// ─── GET /api/gst/profile ─────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    let profile = await GSTProfile.findOne({ orgId: req.user.orgId });
    if (!profile) {
      // Return empty profile object (org hasn't set up GST yet)
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve GST profile.' });
  }
});

// ─── PUT /api/gst/profile — create or update GST profile ─────────────────────
router.put('/profile', [
  body('gstin').optional().trim().isLength({ max: 15 }),
  body('legalName').optional().trim().isLength({ max: 200 }),
  body('tradeName').optional().trim().isLength({ max: 200 }),
  body('registrationType').optional().isIn(['regular', 'qrmp', 'composition', 'unregistered']),
  body('filingFrequency').optional().isIn(['monthly', 'quarterly']),
  body('stateCode').optional().trim().isLength({ max: 2 }),
  body('stateName').optional().trim(),
  body('address').optional().trim().isLength({ max: 500 }),
  body('panNumber').optional().trim().isLength({ max: 10 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const allowed = ['gstin', 'legalName', 'tradeName', 'registrationType', 'filingFrequency', 'stateCode', 'stateName', 'address', 'panNumber'];
    const updates = { orgId: req.user.orgId };
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const profile = await GSTProfile.findOneAndUpdate(
      { orgId: req.user.orgId },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('PUT /gst/profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update GST profile.' });
  }
});

// ─── GET /api/gst/dashboard — GST KPI summary ────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // ITC: sum of all eligible/claimed ITC from expenses
    const [itcAgg, outputAgg, monthlyAgg] = await Promise.all([
      Expense.aggregate([
        { $match: { orgId, gstRate: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalGSTPaid: { $sum: '$gstAmount' },
            totalEligibleITC: { $sum: { $cond: ['$itcEligible', '$gstAmount', 0] } },
            totalClaimedITC: { $sum: { $cond: [{ $and: ['$itcEligible', '$itcClaimed'] }, '$gstAmount', 0] } },
            totalBlockedITC: { $sum: { $cond: [{ $not: '$itcEligible' }, '$gstAmount', 0] } },
            pendingITCCount: {
              $sum: { $cond: [{ $and: ['$itcEligible', { $not: '$itcClaimed' }] }, 1, 0] }
            },
          },
        },
      ]),

      // Output GST from payments
      Payment.aggregate([
        { $match: { orgId, gstRate: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalOutputGST: { $sum: '$gstAmount' },
            totalCGST: { $sum: '$cgst' },
            totalSGST: { $sum: '$sgst' },
            totalIGST: { $sum: '$igst' },
          },
        },
      ]),

      // Monthly breakdown for chart (last 6 months)
      Expense.aggregate([
        { $match: { orgId, gstRate: { $gt: 0 } } },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
            },
            inputGST: { $sum: '$gstAmount' },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 6 },
      ]),
    ]);

    const itc = itcAgg[0] || { totalGSTPaid: 0, totalEligibleITC: 0, totalClaimedITC: 0, totalBlockedITC: 0, pendingITCCount: 0 };
    const output = outputAgg[0] || { totalOutputGST: 0, totalCGST: 0, totalSGST: 0, totalIGST: 0 };
    const pendingITC = itc.totalEligibleITC - itc.totalClaimedITC;
    const netPayable = Math.max(0, output.totalOutputGST - itc.totalClaimedITC);

    res.json({
      success: true,
      data: {
        outputGST: output.totalOutputGST,
        totalCGST: output.totalCGST,
        totalSGST: output.totalSGST,
        totalIGST: output.totalIGST,
        totalGSTPaid: itc.totalGSTPaid,
        eligibleITC: itc.totalEligibleITC,
        claimedITC: itc.totalClaimedITC,
        pendingITC,
        blockedITC: itc.totalBlockedITC,
        pendingITCCount: itc.pendingITCCount,
        netPayable,
        monthlyBreakdown: monthlyAgg,
        currentPeriod,
      },
    });
  } catch (err) {
    console.error('GET /gst/dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute GST dashboard.' });
  }
});

// ─── GET /api/gst/itc — ITC tracker (all expenses with GST) ──────────────────
router.get('/itc', async (req, res) => {
  try {
    const filter = { orgId: req.user.orgId, gstRate: { $gt: 0 } };
    if (req.query.claimed === 'true') filter.itcClaimed = true;
    if (req.query.claimed === 'false') filter.itcClaimed = false;
    if (req.query.eligible === 'false') filter.itcEligible = false;

    const expenses = await Expense.find(filter)
      .populate('siteId', 'code name')
      .sort({ date: -1 });

    res.json({ success: true, count: expenses.length, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve ITC data.' });
  }
});

// ─── POST /api/gst/itc/:expenseId/claim — mark ITC as claimed ────────────────
router.post('/itc/:expenseId/claim', async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.expenseId, orgId: req.user.orgId, itcEligible: true },
      { $set: { itcClaimed: true } },
      { new: true }
    ).populate('siteId', 'code name');

    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found or ITC not eligible.' });
    res.json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to claim ITC.' });
  }
});

// ─── POST /api/gst/itc/:expenseId/unclaim — unmark ITC claim ─────────────────
router.post('/itc/:expenseId/unclaim', async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.expenseId, orgId: req.user.orgId },
      { $set: { itcClaimed: false } },
      { new: true }
    );
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    res.json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to unclaim ITC.' });
  }
});

// ─── GET /api/gst/output — output GST from client payments ───────────────────
router.get('/output', async (req, res) => {
  try {
    const payments = await Payment.find({ orgId: req.user.orgId, gstRate: { $gt: 0 } })
      .populate('siteId', 'code name')
      .sort({ date: -1 });

    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve output GST data.' });
  }
});

// ─── GET /api/gst/returns — list all GST return records ──────────────────────
router.get('/returns', async (req, res) => {
  try {
    const returns = await GSTReturn.find({ orgId: req.user.orgId }).sort({ period: -1, returnType: 1 });
    res.json({ success: true, count: returns.length, data: returns });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve GST returns.' });
  }
});

// ─── POST /api/gst/returns — create/mark a return ────────────────────────────
router.post('/returns', [
  body('returnType').isIn(['GSTR1', 'GSTR3B', 'GSTR2B']).withMessage('Invalid return type'),
  body('period').matches(/^\d{4}-\d{2}$/).withMessage('Period must be YYYY-MM'),
  body('filedDate').optional().isISO8601(),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('challanNo').optional().trim(),
  body('totalOutput').optional().isFloat({ min: 0 }),
  body('totalITC').optional().isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  try {
    const profile = await GSTProfile.findOne({ orgId: req.user.orgId });
    const regType = profile?.registrationType || 'regular';
    const { period, returnType, filedDate, notes, challanNo, totalOutput, totalITC } = req.body;

    const { gstr1Due, gstr3bDue } = getFilingDueDates(period, regType);
    const dueDate = returnType === 'GSTR1' ? gstr1Due : gstr3bDue;

    const now = new Date();
    const isLate = filedDate ? new Date(filedDate) > dueDate : null;
    const status = filedDate ? (isLate ? 'late' : 'filed') : 'pending';

    const netPayable = (totalOutput || 0) - (totalITC || 0);

    const gstReturn = await GSTReturn.findOneAndUpdate(
      { orgId: req.user.orgId, period, returnType },
      {
        $set: {
          orgId: req.user.orgId,
          period,
          returnType,
          dueDate,
          filedDate: filedDate || null,
          status,
          totalOutput: totalOutput || 0,
          totalITC: totalITC || 0,
          netPayable: Math.max(0, netPayable),
          notes: notes || '',
          challanNo: challanNo || '',
        },
      },
      { new: true, upsert: true }
    );

    res.status(201).json({ success: true, data: gstReturn });
  } catch (err) {
    console.error('POST /gst/returns error:', err);
    res.status(500).json({ success: false, message: 'Failed to save GST return.' });
  }
});

// ─── GET /api/gst/alerts — filing alerts ─────────────────────────────────────
router.get('/alerts', async (req, res) => {
  try {
    const profile = await GSTProfile.findOne({ orgId: req.user.orgId });
    if (!profile || profile.registrationType === 'unregistered') {
      return res.json({ success: true, data: [] });
    }

    const now = new Date();
    const alerts = [];

    // Generate alerts for current and next 2 periods
    for (let i = -1; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const { gstr1Due, gstr3bDue } = getFilingDueDates(period, profile.registrationType);

      const filed = await GSTReturn.find({
        orgId: req.user.orgId,
        period,
        status: { $in: ['filed', 'late'] },
      });
      const filedTypes = new Set(filed.map((r) => r.returnType));

      if (gstr1Due && !filedTypes.has('GSTR1')) {
        const diffDays = Math.ceil((gstr1Due - now) / (1000 * 60 * 60 * 24));
        alerts.push({
          returnType: 'GSTR1',
          period,
          dueDate: gstr1Due,
          daysLeft: diffDays,
          status: diffDays < 0 ? 'overdue' : diffDays <= 3 ? 'critical' : diffDays <= 7 ? 'warning' : 'upcoming',
        });
      }

      if (gstr3bDue && !filedTypes.has('GSTR3B')) {
        const diffDays = Math.ceil((gstr3bDue - now) / (1000 * 60 * 60 * 24));
        alerts.push({
          returnType: 'GSTR3B',
          period,
          dueDate: gstr3bDue,
          daysLeft: diffDays,
          status: diffDays < 0 ? 'overdue' : diffDays <= 3 ? 'critical' : diffDays <= 7 ? 'warning' : 'upcoming',
        });
      }
    }

    // Sort by urgency: overdue first, then by daysLeft
    alerts.sort((a, b) => a.daysLeft - b.daysLeft);

    res.json({ success: true, data: alerts });
  } catch (err) {
    console.error('GET /gst/alerts error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute GST alerts.' });
  }
});

// ─── GET /api/gst/savings — GST savings advisor ───────────────────────────────
router.get('/savings', async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const tips = [];

    // Tip 1: Unclaimed ITC
    const unclaimedITC = await Expense.aggregate([
      { $match: { orgId, itcEligible: true, itcClaimed: false, gstRate: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$gstAmount' }, count: { $sum: 1 } } },
    ]);
    if (unclaimedITC[0]?.total > 0) {
      tips.push({
        type: 'success',
        title: 'Unclaimed Input Tax Credit',
        message: `You have ₹${unclaimedITC[0].total.toLocaleString('en-IN')} unclaimed ITC from ${unclaimedITC[0].count} expense(s). Claim before filing GSTR-3B to reduce tax liability.`,
        action: 'claim_itc',
        amount: unclaimedITC[0].total,
        priority: 1,
      });
    }

    // Tip 2: Missing vendor GSTINs (ITC cannot be claimed without vendor GSTIN)
    const missingGSTIN = await Expense.countDocuments({
      orgId,
      gstRate: { $gt: 0 },
      itcEligible: true,
      $or: [{ vendorGstin: '' }, { vendorGstin: null }],
    });
    if (missingGSTIN > 0) {
      tips.push({
        type: 'danger',
        title: 'Missing Vendor GSTINs',
        message: `${missingGSTIN} expense(s) have GST but no vendor GSTIN. ITC cannot be claimed without the supplier's GSTIN. Update vendor details to unlock ITC.`,
        action: 'update_vendors',
        count: missingGSTIN,
        priority: 2,
      });
    }

    // Tip 3: Works contract rate (residential = 12%, commercial = 18%)
    tips.push({
      type: 'info',
      title: 'Works Contract GST Rate',
      message: 'Residential construction projects qualify for 12% GST under Works Contract (SAC 9954). Verify your project types are correctly classified to avoid overpaying.',
      action: 'review_rates',
      priority: 3,
    });

    // Tip 4: Blocked ITC categories
    const blockedITC = await Expense.aggregate([
      { $match: { orgId, itcEligible: false, gstRate: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$gstAmount' } } },
    ]);
    if (blockedITC[0]?.total > 0) {
      tips.push({
        type: 'warning',
        title: 'Blocked ITC Identified',
        message: `₹${blockedITC[0].total.toLocaleString('en-IN')} GST is blocked (Section 17(5) — motor vehicles, food, personal use). These cannot be claimed as ITC.`,
        action: 'view_blocked',
        amount: blockedITC[0].total,
        priority: 4,
      });
    }

    // Sort by priority
    tips.sort((a, b) => a.priority - b.priority);

    res.json({ success: true, data: tips });
  } catch (err) {
    console.error('GET /gst/savings error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute GST savings tips.' });
  }
});

module.exports = router;
