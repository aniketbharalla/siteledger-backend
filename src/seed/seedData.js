/**
 * Static seed data for SiteLedger.
 * Site documents are inserted first; investor / expense / payment records
 * reference them by the index in the `sites` array (resolved at seed time).
 */

const sites = [
  {
    code: 'MH-01',
    name: 'Maple Heights Residency',
    location: 'Sector 62, Noida',
    status: 'active',
    startDate: new Date('2025-08-14'),
    totalBudget: 42_000_000,
    cover: 'oklch(0.68 0.12 55)',
  },
  {
    code: 'KT-02',
    name: 'Kestrel Tower',
    location: 'Andheri West, Mumbai',
    status: 'active',
    startDate: new Date('2025-05-02'),
    totalBudget: 68_500_000,
    cover: 'oklch(0.58 0.10 230)',
  },
  {
    code: 'AP-03',
    name: 'Azure Park Villas',
    location: 'Whitefield, Bengaluru',
    status: 'active',
    startDate: new Date('2026-01-20'),
    totalBudget: 31_200_000,
    cover: 'oklch(0.58 0.14 145)',
  },
  {
    code: 'OR-04',
    name: 'Orchid Commercial Plaza',
    location: 'Gachibowli, Hyderabad',
    status: 'completed',
    startDate: new Date('2024-11-08'),
    totalBudget: 24_800_000,
    cover: 'oklch(0.62 0.02 80)',
  },
];

/**
 * Each investor references a site by its index in the `sites` array above.
 * `siteIndex` is resolved to a real ObjectId during seeding.
 */
const investors = [
  // MH-01 – Maple Heights Residency
  { siteIndex: 0, name: 'R. Shankar Ventures', amount: 12_000_000, share: 40, date: new Date('2025-08-14') },
  { siteIndex: 0, name: 'Meera Kapoor',        amount:  9_000_000, share: 30, date: new Date('2025-08-14') },
  { siteIndex: 0, name: 'Crestline Capital',   amount:  6_000_000, share: 20, date: new Date('2025-08-20') },
  { siteIndex: 0, name: 'Self',                amount:  3_000_000, share: 10, date: new Date('2025-08-14') },

  // KT-02 – Kestrel Tower
  { siteIndex: 1, name: 'Bluegate Holdings',  amount: 28_000_000, share: 46.7, date: new Date('2025-05-02') },
  { siteIndex: 1, name: 'A. Devraj & Sons',   amount: 18_000_000, share: 30,   date: new Date('2025-05-02') },
  { siteIndex: 1, name: 'Self',               amount: 14_000_000, share: 23.3, date: new Date('2025-05-02') },

  // AP-03 – Azure Park Villas
  { siteIndex: 2, name: 'GreenAcre Fund',          amount: 11_000_000, share: 50, date: new Date('2026-01-20') },
  { siteIndex: 2, name: 'Self',                     amount:  5_500_000, share: 25, date: new Date('2026-01-20') },
  { siteIndex: 2, name: 'V. Iyer Family Trust',     amount:  5_500_000, share: 25, date: new Date('2026-01-20') },

  // OR-04 – Orchid Commercial Plaza
  { siteIndex: 3, name: 'Orchid Realty LLP', amount: 14_000_000, share: 60,   date: new Date('2024-11-08') },
  { siteIndex: 3, name: 'Self',              amount:  6_000_000, share: 26,   date: new Date('2024-11-08') },
  { siteIndex: 3, name: 'P. Mehra',          amount:  3_250_000, share: 14,   date: new Date('2024-11-10') },
];

const expenses = [
  // ── MH-01 ──────────────────────────────────────────────────────────────────
  { siteIndex: 0, name: 'Cement & Aggregate Supply',    vendor: 'Prism BuildMart',     category: 'material', amount:  1_850_000, date: new Date('2025-09-05'), status: 'paid'    },
  { siteIndex: 0, name: 'Structural Steel (Phase 1)',   vendor: 'UltraSteel Pvt Ltd',  category: 'material', amount:  3_200_000, date: new Date('2025-09-18'), status: 'paid'    },
  { siteIndex: 0, name: 'Foundation Labour Charges',    vendor: 'KK Civil Works',      category: 'labor',    amount:    780_000, date: new Date('2025-10-01'), status: 'paid'    },
  { siteIndex: 0, name: 'Plumbing Materials',           vendor: 'AquaPipe Solutions',  category: 'material', amount:    560_000, date: new Date('2025-10-15'), status: 'paid'    },
  { siteIndex: 0, name: 'Site Security (6 months)',     vendor: 'GuardForce India',    category: 'misc',     amount:    210_000, date: new Date('2025-11-01'), status: 'paid'    },
  { siteIndex: 0, name: 'Electrical Wiring (Phase 1)',  vendor: 'Spark Electricals',   category: 'material', amount:    940_000, date: new Date('2025-11-20'), status: 'paid'    },
  { siteIndex: 0, name: 'Masonry Labour (Block 1–3)',   vendor: 'Raj Constructions',   category: 'labor',    amount:  1_100_000, date: new Date('2025-12-10'), status: 'paid'    },
  { siteIndex: 0, name: 'Shuttering & Formwork',        vendor: 'FormTech Rentals',    category: 'misc',     amount:    380_000, date: new Date('2026-01-08'), status: 'pending' },
  { siteIndex: 0, name: 'Tiles & Flooring Material',    vendor: 'Ceramica India',      category: 'material', amount:    720_000, date: new Date('2026-02-14'), status: 'pending' },
  { siteIndex: 0, name: 'Interior Labour Charges',      vendor: 'Finish Craft Co.',    category: 'labor',    amount:    850_000, date: new Date('2026-03-01'), status: 'pending' },

  // ── KT-02 ──────────────────────────────────────────────────────────────────
  { siteIndex: 1, name: 'High-Grade Concrete Mix',      vendor: 'ConcreteX Mumbai',    category: 'material', amount:  4_500_000, date: new Date('2025-06-10'), status: 'paid'    },
  { siteIndex: 1, name: 'Structural Glazing Supply',    vendor: 'GlassTech India',     category: 'material', amount:  6_200_000, date: new Date('2025-07-05'), status: 'paid'    },
  { siteIndex: 1, name: 'Core Drilling & Piling Labour',vendor: 'DeepFound Engineers', category: 'labor',    amount:  2_300_000, date: new Date('2025-07-20'), status: 'paid'    },
  { siteIndex: 1, name: 'Tower Crane Rental (Q3)',      vendor: 'LiftEquip Rentals',   category: 'misc',     amount:  1_800_000, date: new Date('2025-08-01'), status: 'paid'    },
  { siteIndex: 1, name: 'MEP Rough-In Materials',       vendor: 'BMS Engineering',     category: 'material', amount:  3_100_000, date: new Date('2025-09-12'), status: 'paid'    },
  { siteIndex: 1, name: 'Superstructure Labour (Flr 1–10)', vendor: 'Apex Build Crew', category: 'labor',    amount:  3_800_000, date: new Date('2025-10-30'), status: 'paid'    },
  { siteIndex: 1, name: 'Safety Nets & Scaffolding',    vendor: 'SafeHigh Infra',      category: 'misc',     amount:    640_000, date: new Date('2025-11-14'), status: 'paid'    },
  { siteIndex: 1, name: 'Aluminium Cladding Panels',    vendor: 'CladdingPro Ltd',     category: 'material', amount:  5_400_000, date: new Date('2025-12-20'), status: 'pending' },
  { siteIndex: 1, name: 'HVAC Ducting Materials',       vendor: 'AirMech Systems',     category: 'material', amount:  2_750_000, date: new Date('2026-01-25'), status: 'pending' },
  { siteIndex: 1, name: 'Finishing Labour (Flr 1–5)',   vendor: 'Prestige Interiors',  category: 'labor',    amount:  2_100_000, date: new Date('2026-02-18'), status: 'pending' },

  // ── AP-03 ──────────────────────────────────────────────────────────────────
  { siteIndex: 2, name: 'Site Clearing & Earthwork',    vendor: 'GreenBuild Corps',    category: 'labor',    amount:    420_000, date: new Date('2026-02-10'), status: 'paid'    },
  { siteIndex: 2, name: 'Foundation PCC & RCC',         vendor: 'Solid Base Infra',    category: 'material', amount:  1_650_000, date: new Date('2026-03-05'), status: 'paid'    },
  { siteIndex: 2, name: 'Architect & Survey Fees',      vendor: 'Studio Blueprint LLP',category: 'misc',     amount:    320_000, date: new Date('2026-01-25'), status: 'paid'    },
  { siteIndex: 2, name: 'Retaining Wall Materials',     vendor: 'StoneWork India',     category: 'material', amount:    870_000, date: new Date('2026-03-22'), status: 'paid'    },
  { siteIndex: 2, name: 'Perimeter Fencing',            vendor: 'SecureFence Co.',     category: 'misc',     amount:    195_000, date: new Date('2026-04-01'), status: 'pending' },
  { siteIndex: 2, name: 'Civil Labour (Block A Shell)', vendor: 'BuildBridge Works',   category: 'labor',    amount:    960_000, date: new Date('2026-04-15'), status: 'pending' },

  // ── OR-04 ──────────────────────────────────────────────────────────────────
  { siteIndex: 3, name: 'Foundation & Basement RCC',    vendor: 'TerraBase Constructions', category: 'material', amount: 2_800_000, date: new Date('2024-11-20'), status: 'paid' },
  { siteIndex: 3, name: 'Structural Steel Frame',       vendor: 'MetalCore Engineers',     category: 'material', amount: 4_600_000, date: new Date('2024-12-10'), status: 'paid' },
  { siteIndex: 3, name: 'Labour – Main Superstructure', vendor: 'BuildRight Contractors',  category: 'labor',    amount: 2_200_000, date: new Date('2025-01-08'), status: 'paid' },
  { siteIndex: 3, name: 'Façade Cladding & Glass',      vendor: 'FaçadeCraft India',       category: 'material', amount: 3_100_000, date: new Date('2025-02-14'), status: 'paid' },
  { siteIndex: 3, name: 'Electrical & Fire Safety',     vendor: 'Safe Systems Pvt Ltd',    category: 'material', amount: 1_450_000, date: new Date('2025-03-05'), status: 'paid' },
  { siteIndex: 3, name: 'Landscaping & Paving',         vendor: 'GreenSpace Designers',    category: 'misc',     amount:   480_000, date: new Date('2025-04-01'), status: 'paid' },
  { siteIndex: 3, name: 'Interior Finishing Labour',    vendor: 'Artisan Interiors',       category: 'labor',    amount: 1_680_000, date: new Date('2025-05-10'), status: 'paid' },
  { siteIndex: 3, name: 'Commissioning & Handover',     vendor: 'ProComm Services',        category: 'misc',     amount:   310_000, date: new Date('2025-07-01'), status: 'paid' },
];

const payments = [
  // ── MH-01 ──────────────────────────────────────────────────────────────────
  { siteIndex: 0, clientName: 'Ashok Mehra',        amount: 2_500_000, date: new Date('2025-11-15'), milestone: 'Booking Advance'          },
  { siteIndex: 0, clientName: 'Sunita Rao',          amount: 1_800_000, date: new Date('2025-12-01'), milestone: 'Booking Advance'          },
  { siteIndex: 0, clientName: 'Ashok Mehra',        amount: 3_000_000, date: new Date('2026-01-20'), milestone: 'Slab Completion – Floor 2' },
  { siteIndex: 0, clientName: 'Vijay Constructions', amount: 4_200_000, date: new Date('2026-02-28'), milestone: 'Structure Completion'      },
  { siteIndex: 0, clientName: 'Sunita Rao',          amount: 2_400_000, date: new Date('2026-03-15'), milestone: 'Slab Completion – Floor 4' },

  // ── KT-02 ──────────────────────────────────────────────────────────────────
  { siteIndex: 1, clientName: 'NexGen Realtors',    amount: 8_000_000, date: new Date('2025-08-10'), milestone: 'Booking & Launch Advance'  },
  { siteIndex: 1, clientName: 'Priya Malhotra',     amount: 3_500_000, date: new Date('2025-10-05'), milestone: 'Foundation Completion'     },
  { siteIndex: 1, clientName: 'NexGen Realtors',    amount: 6_000_000, date: new Date('2025-12-20'), milestone: 'Superstructure – 10 floors' },
  { siteIndex: 1, clientName: 'Anupam Holdings',    amount: 5_200_000, date: new Date('2026-02-14'), milestone: 'Cladding Completion'        },

  // ── AP-03 ──────────────────────────────────────────────────────────────────
  { siteIndex: 2, clientName: 'EcoVilla Buyers',    amount: 2_200_000, date: new Date('2026-02-28'), milestone: 'Plot Booking'               },
  { siteIndex: 2, clientName: 'Harish Kumar',       amount: 1_500_000, date: new Date('2026-04-10'), milestone: 'Foundation Advance'         },

  // ── OR-04 ──────────────────────────────────────────────────────────────────
  { siteIndex: 3, clientName: 'TechPark Ventures',  amount: 5_000_000, date: new Date('2024-12-15'), milestone: 'Shell & Core – 50%'         },
  { siteIndex: 3, clientName: 'Retail Spaces Ltd',  amount: 4_000_000, date: new Date('2025-02-20'), milestone: 'Structure Complete'          },
  { siteIndex: 3, clientName: 'TechPark Ventures',  amount: 6_500_000, date: new Date('2025-05-01'), milestone: 'Fit-Out Handover'            },
  { siteIndex: 3, clientName: 'Retail Spaces Ltd',  amount: 3_800_000, date: new Date('2025-07-15'), milestone: 'Final Handover & Registration'},
];

module.exports = { sites, investors, expenses, payments };
