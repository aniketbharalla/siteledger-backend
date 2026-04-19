const express = require('express');
const mongoose = require('mongoose');
const Site = require('../models/Site');
const Investor = require('../models/Investor');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');
const { sites, investors, expenses, payments } = require('../seed/seedData');

const router = express.Router();

/**
 * POST /api/seed
 *
 * Wipes existing sites/investors/expenses/payments and re-inserts the
 * canonical seed data. Protected by the x-seed-secret header.
 *
 * Headers required:
 *   x-seed-secret: <value matching SEED_SECRET env var>
 */
router.post('/', async (req, res) => {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret) {
    return res.status(503).json({
      success: false,
      message: 'Seed endpoint is not configured (SEED_SECRET not set).',
    });
  }

  const provided = req.headers['x-seed-secret'];
  if (!provided || provided !== seedSecret) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing x-seed-secret header.',
    });
  }

  // Use a session for atomicity where supported
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // ── Wipe existing data ──────────────────────────────────────────────────
    await Promise.all([
      Site.deleteMany({}, { session }),
      Investor.deleteMany({}, { session }),
      Expense.deleteMany({}, { session }),
      Payment.deleteMany({}, { session }),
    ]);

    // ── Insert sites ────────────────────────────────────────────────────────
    const insertedSites = await Site.insertMany(sites, { session });

    // ── Resolve siteIndex → ObjectId for sub-documents ──────────────────────
    const resolveId = (siteIndex) => {
      const s = insertedSites[siteIndex];
      if (!s) throw new Error(`Invalid siteIndex: ${siteIndex}`);
      return s._id;
    };

    const investorDocs = investors.map(({ siteIndex, ...rest }) => ({
      ...rest,
      siteId: resolveId(siteIndex),
    }));

    const expenseDocs = expenses.map(({ siteIndex, ...rest }) => ({
      ...rest,
      siteId: resolveId(siteIndex),
    }));

    const paymentDocs = payments.map(({ siteIndex, ...rest }) => ({
      ...rest,
      siteId: resolveId(siteIndex),
    }));

    // ── Insert sub-documents ─────────────────────────────────────────────────
    const [insertedInvestors, insertedExpenses, insertedPayments] = await Promise.all([
      Investor.insertMany(investorDocs, { session }),
      Expense.insertMany(expenseDocs, { session }),
      Payment.insertMany(paymentDocs, { session }),
    ]);

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Database seeded successfully.',
      summary: {
        sites: insertedSites.length,
        investors: insertedInvestors.length,
        expenses: insertedExpenses.length,
        payments: insertedPayments.length,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Seed error:', err);
    res.status(500).json({ success: false, message: `Seed failed: ${err.message}` });
  } finally {
    session.endSession();
  }
});

module.exports = router;
