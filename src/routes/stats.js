const express = require('express');
const { query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Site = require('../models/Site');
const Investor = require('../models/Investor');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Converts a comma-separated string of IDs to an array of ObjectIds,
 * silently dropping any that are not valid.
 */
const parseIds = (raw) => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => mongoose.Types.ObjectId.isValid(s))
    .map((s) => new mongoose.Types.ObjectId(s));
};

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /api/stats?siteIds=id1,id2
 *
 * Returns aggregated financial KPIs for the requested sites.
 * If siteIds is omitted, all sites are included.
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     totalInvestment : Number,   // sum of all investor amounts
 *     totalExpenses   : Number,   // sum of all expenses
 *     totalReceived   : Number,   // sum of all client payments
 *     profit          : Number,   // totalReceived - totalExpenses
 *     byCat: {
 *       material : Number,
 *       labor    : Number,
 *       misc     : Number,
 *     },
 *     sites: [
 *       {
 *         site           : SiteDocument,
 *         investment     : Number,
 *         expenses       : Number,
 *         received       : Number,
 *         profit         : Number,
 *         expensesByCat  : { material, labor, misc },
 *         investorCount  : Number,
 *         paymentCount   : Number,
 *       }
 *     ]
 *   }
 * }
 */
router.get(
  '/',
  [
    query('siteIds')
      .optional()
      .isString()
      .withMessage('siteIds must be a comma-separated string of ObjectIds'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      // ── 1. Resolve which sites to include ───────────────────────────────────
      let siteFilter = {};
      const requestedIds = parseIds(req.query.siteIds);

      if (requestedIds.length > 0) {
        siteFilter = { _id: { $in: requestedIds } };
      }

      const sites = await Site.find(siteFilter).sort({ startDate: -1 }).lean();

      if (sites.length === 0) {
        return res.json({
          success: true,
          data: {
            totalInvestment: 0,
            totalExpenses: 0,
            totalReceived: 0,
            profit: 0,
            byCat: { material: 0, labor: 0, misc: 0 },
            sites: [],
          },
        });
      }

      const siteIds = sites.map((s) => s._id);

      // ── 2. Run parallel aggregations ────────────────────────────────────────

      const [investorAgg, expenseAgg, paymentAgg] = await Promise.all([
        // Sum investment grouped by site
        Investor.aggregate([
          { $match: { siteId: { $in: siteIds } } },
          {
            $group: {
              _id: '$siteId',
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ]),

        // Sum expenses grouped by site AND category
        Expense.aggregate([
          { $match: { siteId: { $in: siteIds } } },
          {
            $group: {
              _id: { siteId: '$siteId', category: '$category' },
              total: { $sum: '$amount' },
            },
          },
        ]),

        // Sum payments grouped by site
        Payment.aggregate([
          { $match: { siteId: { $in: siteIds } } },
          {
            $group: {
              _id: '$siteId',
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      // ── 3. Build lookup maps for O(1) access ────────────────────────────────

      /** @type {Map<string, { total: number, count: number }>} */
      const investorMap = new Map(
        investorAgg.map((r) => [r._id.toString(), { total: r.total, count: r.count }])
      );

      /** @type {Map<string, { material: number, labor: number, misc: number }>} */
      const expenseByCatMap = new Map();
      for (const r of expenseAgg) {
        const key = r._id.siteId.toString();
        if (!expenseByCatMap.has(key)) {
          expenseByCatMap.set(key, { material: 0, labor: 0, misc: 0 });
        }
        expenseByCatMap.get(key)[r._id.category] += r.total;
      }

      /** @type {Map<string, { total: number, count: number }>} */
      const paymentMap = new Map(
        paymentAgg.map((r) => [r._id.toString(), { total: r.total, count: r.count }])
      );

      // ── 4. Compose per-site summaries ────────────────────────────────────────

      let globalInvestment = 0;
      let globalExpenses = 0;
      let globalReceived = 0;
      const globalByCat = { material: 0, labor: 0, misc: 0 };

      const siteSummaries = sites.map((site) => {
        const key = site._id.toString();

        const investorData = investorMap.get(key) || { total: 0, count: 0 };
        const expCat = expenseByCatMap.get(key) || { material: 0, labor: 0, misc: 0 };
        const paymentData = paymentMap.get(key) || { total: 0, count: 0 };

        const siteExpenses = expCat.material + expCat.labor + expCat.misc;
        const siteReceived = paymentData.total;
        const siteProfit = siteReceived - siteExpenses;

        globalInvestment += investorData.total;
        globalExpenses += siteExpenses;
        globalReceived += siteReceived;
        globalByCat.material += expCat.material;
        globalByCat.labor += expCat.labor;
        globalByCat.misc += expCat.misc;

        return {
          site,
          investment: investorData.total,
          investorCount: investorData.count,
          expenses: siteExpenses,
          expensesByCat: expCat,
          received: siteReceived,
          paymentCount: paymentData.count,
          profit: siteProfit,
        };
      });

      // ── 5. Return ────────────────────────────────────────────────────────────

      res.json({
        success: true,
        data: {
          totalInvestment: globalInvestment,
          totalExpenses: globalExpenses,
          totalReceived: globalReceived,
          profit: globalReceived - globalExpenses,
          byCat: globalByCat,
          sites: siteSummaries,
        },
      });
    } catch (err) {
      console.error('GET /stats error:', err);
      res.status(500).json({ success: false, message: 'Failed to compute stats.' });
    }
  }
);

module.exports = router;
