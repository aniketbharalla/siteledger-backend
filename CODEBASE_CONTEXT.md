# SiteLedger Backend — Codebase Context

> **Purpose:** Construction Financial Dashboard REST API  
> **Stack:** Node.js · Express · MongoDB (Mongoose) · JWT Auth  
> **Deployment:** Render (render.yaml included)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Environment Variables](#4-environment-variables)
5. [Entry Point — index.js](#5-entry-point--indexjs)
6. [Database Connection](#6-database-connection)
7. [Authentication Middleware](#7-authentication-middleware)
8. [Data Models](#8-data-models)
9. [API Routes — Full Reference](#9-api-routes--full-reference)
10. [Role-Based Access Control (RBAC)](#10-role-based-access-control-rbac)
11. [Seed Endpoint](#11-seed-endpoint)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Deployment (Render)](#13-deployment-render)
14. [Local Dev Setup](#14-local-dev-setup)
15. [Key Design Decisions](#15-key-design-decisions)

---

## 1. Project Overview

**SiteLedger** is a multi-tenant construction finance dashboard API. Each tenant is an **Organisation**. Users inside an organisation can manage **construction sites**, record **expenses**, track **investor funding**, and log **client payments**.

The API provides:
- JWT-based authentication with role hierarchy (owner → admin → member)
- Invite-code-based team onboarding
- Full CRUD for sites, expenses, investors, payments
- Aggregated financial KPIs via `/api/stats`
- A protected seed endpoint for demo data

---

## 2. Folder Structure

```
siteledger-backend/
├── index.js                  # Entry point — Express app bootstrap
├── package.json
├── render.yaml               # Render deployment config
├── .env.example              # Environment variable template
└── src/
    ├── config/
    │   └── db.js             # MongoDB connection (Mongoose)
    ├── middleware/
    │   └── auth.js           # JWT protect + restrictTo helpers
    ├── models/
    │   ├── Organisation.js   # Org schema (name, inviteCode)
    │   ├── User.js           # User schema (name, email, password, role, orgId)
    │   ├── Site.js           # Site schema (code, name, location, status, budget)
    │   ├── Investor.js       # Investor schema (siteId, name, amount, share%)
    │   ├── Expense.js        # Expense schema (siteId, vendor, category, amount, status)
    │   └── Payment.js        # Payment schema (siteId, clientName, amount, milestone)
    ├── routes/
    │   ├── auth.js           # /api/auth/* — register, login, me, members
    │   ├── sites.js          # /api/sites/* — CRUD
    │   ├── investors.js      # /api/investors/* — CRUD + auto share%
    │   ├── expenses.js       # /api/expenses/* — CRUD + filters
    │   ├── payments.js       # /api/payments/* — CRUD
    │   ├── stats.js          # /api/stats — aggregated KPIs
    │   └── seed.js           # /api/seed — demo data loader
    └── seed/
        └── seedData.js       # Static demo sites/investors/expenses/payments
```

---

## 3. Tech Stack & Dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.19.2 | HTTP framework |
| `mongoose` | ^8.23.1 | MongoDB ODM |
| `mongodb` | ^7.2.0 | Native driver (peer dep) |
| `jsonwebtoken` | ^9.0.2 | JWT sign/verify |
| `bcryptjs` | ^2.4.3 | Password hashing (salt rounds: 12) |
| `express-validator` | ^7.1.0 | Request body/query validation |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing |
| `dotenv` | ^16.4.5 | `.env` loading |
| `nodemon` | ^3.1.3 | Dev auto-restart (devDep) |

**Node requirement:** `>=18.0.0`

---

## 4. Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | No | `5000` | HTTP listen port |
| `MONGODB_URI` | **Yes** | — | Full MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | Long random secret for JWT signing |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiry duration |
| `CORS_ORIGIN` | No | `*` | Comma-separated frontend origins, `*` for dev |
| `SEED_SECRET` | No | — | Header secret to call `POST /api/seed` |

**Local URI examples:**
- Local: `mongodb://127.0.0.1:27017/siteledger`
- Atlas: `mongodb+srv://<user>:<password>@cluster.mongodb.net/siteledger`

Copy `.env.example` → `.env` to get started.

---

## 5. Entry Point — `index.js`

The app bootstrap flow:
1. Load `.env` via `dotenv`
2. Configure CORS from `CORS_ORIGIN` env var  
   - If `*` → allow all origins, `credentials: false`  
   - If specific origin(s) → split by comma, `credentials: true`
3. Mount body parsers (`express.json` limit `10kb`, `urlencoded`)
4. Register `/health` check route (no auth)
5. Mount all API route handlers under `/api/`
6. Register 404 catch-all and global error handler
7. Connect to MongoDB, then start `app.listen()`

**Registered routes:**
```
GET  /health                    → health check
/api/auth      → auth.js
/api/sites     → sites.js
/api/investors → investors.js
/api/expenses  → expenses.js
/api/payments  → payments.js
/api/stats     → stats.js
/api/seed      → seed.js
```

**Global error handler** catches:
- `ValidationError` (Mongoose) → 422
- `CastError` (invalid ObjectId) → 400
- Duplicate key error (`code 11000`) → 409
- Everything else → 500

---

## 6. Database Connection

**File:** `src/config/db.js`

- Reads `MONGODB_URI` from env (throws if missing)
- Calls `mongoose.connect()` (Mongoose 8 — no deprecated flags needed)
- Logs `connected`, `error`, and `disconnected` events
- Used in `index.js` inside an async IIFE; server only starts after successful connection

---

## 7. Authentication Middleware

**File:** `src/middleware/auth.js`

### `protect` middleware
- Reads `Authorization: Bearer <token>` header
- Verifies JWT with `JWT_SECRET`
- Handles `TokenExpiredError` separately (clear message to client)
- Loads the user from DB (without password), attaches to `req.user`
- Returns 401 on all failure cases

### `restrictTo(...roles)` factory
- Higher-order middleware; checks `req.user.role` is in the allowed list
- Returns 403 if role is not permitted
- Must be used **after** `protect`

> Note: `restrictTo` is defined but most routes use inline role checks instead of calling `restrictTo` explicitly.

---

## 8. Data Models

All models use **org-scoping**: every document has an `orgId` field referencing the `Organisation` collection. Queries always filter by `orgId: req.user.orgId` — this is the multi-tenancy boundary.

### `Organisation`
```
name         String, required, max 120
inviteCode   String, unique, auto-generated (6-char hex uppercase, e.g. "A3F9C2")
timestamps   createdAt, updatedAt
```
Used to group users and all their data. The `inviteCode` is shared out-of-band to let admins join.

---

### `User`
```
name         String, required, max 80
email        String, required, unique, lowercase
password     String, required, min 6, select: false (never returned by default)
orgId        ObjectId → Organisation, default null
role         enum: ['owner', 'admin', 'member'], default 'member'
timestamps   createdAt, updatedAt
```
**Hooks:**
- `pre('save')` — bcrypt hash password if modified (salt rounds: 12)
- `toJSON()` — strips `password` from serialised output
- `comparePassword(candidate)` — bcrypt compare helper

---

### `Site`
```
code         String, required, unique, uppercase, max 10  (auto-generated as SITE-<timestamp> if not provided)
name         String, required, max 120
location     String, required
status       enum: ['active', 'completed'], default 'active'
startDate    Date, required
totalBudget  Number, required, min 0
cover        String (OKLCH color string), default 'oklch(0.62 0.08 220)'
orgId        ObjectId → Organisation, required, indexed
timestamps   createdAt, updatedAt
```
Indexes: `{ status: 1 }`

---

### `Investor`
```
siteId       ObjectId → Site, required, indexed
name         String, required, max 120
amount       Number, required, min 0
share        Number, 0–100, auto-calculated % (see recalcShares)
date         Date, required, default: now
orgId        ObjectId → Organisation, required, indexed
timestamps   createdAt, updatedAt
```
Indexes: `{ siteId: 1 }`, `{ siteId: 1, name: 1 }`

**`recalcShares(siteId)` helper (in investors.js):**  
After every create/update/delete of an investor, all investors for that site get their `share` field recalculated as `(amount / totalAmount) * 100` (4 decimal places).

---

### `Expense`
```
siteId       ObjectId → Site, required, indexed
name         String, required, max 200
vendor       String, required, max 120
category     enum: ['material', 'labor', 'misc'], required
amount       Number, required, min 0
date         Date, required, default: now
status       enum: ['paid', 'pending'], default 'pending'
orgId        ObjectId → Organisation, required, indexed
timestamps   createdAt, updatedAt
```
Indexes: `{ siteId: 1 }`, `{ siteId: 1, category: 1 }`, `{ siteId: 1, status: 1 }`, `{ date: -1 }`

---

### `Payment`
```
siteId       ObjectId → Site, required, indexed
clientName   String, required, max 120
amount       Number, required, min 0
date         Date, required, default: now
milestone    String, required, max 200
orgId        ObjectId → Organisation, required, indexed
timestamps   createdAt, updatedAt
```
Indexes: `{ siteId: 1 }`, `{ siteId: 1, date: -1 }`

---

## 9. API Routes — Full Reference

> All routes (except `/health` and `/api/auth/login`, `/api/auth/register/*`) require `Authorization: Bearer <token>` header.

### Auth — `/api/auth`

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/register/org` | ❌ | `orgName, name, email, password` | Create new org + owner account |
| POST | `/register/admin` | ❌ | `inviteCode, name, email, password` | Join existing org as admin |
| POST | `/members` | ✅ owner/admin | `name, email, password` | Add a member to the org |
| GET | `/members` | ✅ owner/admin | — | List all members in the org |
| DELETE | `/members/:id` | ✅ owner/admin | — | Remove a member |
| POST | `/login` | ❌ | `email, password` | Returns JWT + user info |
| GET | `/me` | ✅ | — | Returns current user + org info |

**Login response shape:**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": "...", "name": "...", "email": "...",
    "role": "owner|admin|member",
    "orgId": "...", "orgName": "...", "inviteCode": "..."
  }
}
```

---

### Sites — `/api/sites`

> **Role restriction:** `member` role → 403 on ALL site routes.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List all sites for the org (sorted by startDate desc) |
| POST | `/` | Create a new site (code auto-generated if omitted) |
| GET | `/:id` | Get single site by ID |
| PUT | `/:id` | Update site fields |
| DELETE | `/:id` | Delete site |

**POST/PUT body fields:** `code`, `name`, `location`, `status`, `startDate`, `totalBudget`, `cover`

---

### Investors — `/api/investors`

> **Role restriction:** `member` role → 403 on ALL investor routes.  
> Share % is auto-recalculated on every write.

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/` | `siteId` (optional) | List investors (populate siteId fields) |
| POST | `/` | — | Add investor; triggers `recalcShares` |
| PUT | `/:id` | — | Update investor; triggers `recalcShares` |
| DELETE | `/:id` | — | Delete investor; triggers `recalcShares` |

**POST body:** `siteId`, `name`, `amount`, `date`

---

### Expenses — `/api/expenses`

> **Role restriction:** `member` role can GET and POST only (not PUT/DELETE).

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/` | `siteId`, `category`, `status` | List expenses with optional filters |
| POST | `/` | — | Create expense (validates site belongs to org) |
| PUT | `/:id` | — | Update expense |
| DELETE | `/:id` | — | Delete expense |

**POST body:** `siteId`, `name`, `vendor`, `category` (`material|labor|misc`), `amount`, `date`, `status` (`paid|pending`)

---

### Payments — `/api/payments`

> **Role restriction:** `member` role → 403 on ALL payment routes.

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/` | `siteId` (optional) | List payments (populate siteId fields) |
| POST | `/` | — | Create payment (validates site belongs to org) |
| PUT | `/:id` | — | Update payment |
| DELETE | `/:id` | — | Delete payment |

**POST body:** `siteId`, `clientName`, `amount`, `date`, `milestone`

---

### Stats — `/api/stats`

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/` | `siteIds` (optional, comma-separated ObjectIds) | Returns aggregated KPIs |

**Response shape:**
```json
{
  "success": true,
  "data": {
    "totalInvestment": 0,
    "totalExpenses": 0,
    "totalReceived": 0,
    "profit": 0,
    "byCat": { "material": 0, "labor": 0, "misc": 0 },
    "sites": [
      {
        "site": { /* Site document */ },
        "investment": 0,
        "investorCount": 0,
        "expenses": 0,
        "expensesByCat": { "material": 0, "labor": 0, "misc": 0 },
        "received": 0,
        "paymentCount": 0,
        "profit": 0
      }
    ]
  }
}
```

**Implementation:** Uses `Promise.all` with three parallel `aggregate()` pipelines (investors, expenses by category, payments) then builds O(1) lookup Maps to compose per-site summaries in a single `.map()` pass.

---

## 10. Role-Based Access Control (RBAC)

| Action | owner | admin | member |
|---|:---:|:---:|:---:|
| Register org (self) | ✅ | — | — |
| Join org via invite | — | ✅ | — |
| Add/remove members | ✅ | ✅ | ❌ |
| View members | ✅ | ✅ | ❌ |
| Sites (CRUD) | ✅ | ✅ | ❌ |
| Investors (CRUD) | ✅ | ✅ | ❌ |
| Expenses (GET, POST) | ✅ | ✅ | ✅ |
| Expenses (PUT, DELETE) | ✅ | ✅ | ❌ |
| Payments (CRUD) | ✅ | ✅ | ❌ |
| Stats | ✅ | ✅ | ✅ |

> Members are created exclusively by owners/admins via `POST /api/auth/members` — they cannot self-register.

---

## 11. Seed Endpoint

**Route:** `POST /api/seed`  
**Auth:** No JWT needed, but requires header `x-seed-secret: <SEED_SECRET>`

- Wipes all Sites, Investors, Expenses, Payments using a Mongoose **transaction** (atomic)
- Inserts demo data from `src/seed/seedData.js`
- `seedData.js` uses `siteIndex` (array index) to cross-reference sub-documents; the route resolves these to actual ObjectIds after `insertMany` for Sites
- Returns a summary `{ sites, investors, expenses, payments }` count on success
- If `SEED_SECRET` env var is not set → returns 503

---

## 12. Error Handling Strategy

**Per-route validation:** Uses `express-validator` chains on `body()`, `query()`, `param()`. On failure, returns `422` with `errors` array.

**Global error handler (index.js):**
- `ValidationError` → 422 with joined messages
- `CastError` → 400 invalid ObjectId
- Duplicate key (11000) → 409 with field name
- All other → 500 with `err.message`

**Auth errors:**
- No/bad token → 401
- Expired token → 401 with specific message
- User deleted → 401
- Wrong role → 403

**Standard response envelope:**
```json
{ "success": true/false, "data": {}, "message": "...", "count": 0 }
```

---

## 13. Deployment (Render)

**File:** `render.yaml`

```yaml
services:
  - type: web
    name: siteledger-api
    runtime: node
    buildCommand: npm install
    startCommand: node index.js
    envVars:
      - key: NODE_ENV       → production
      - key: MONGODB_URI    → set in Render dashboard (not synced)
      - key: JWT_SECRET     → auto-generated by Render
      - key: JWT_EXPIRES_IN → 7d
      - key: CORS_ORIGIN    → set in Render dashboard (Vercel frontend URL)
      - key: SEED_SECRET    → auto-generated by Render
```

Set `MONGODB_URI` and `CORS_ORIGIN` manually in the Render dashboard before deploying.

---

## 14. Local Dev Setup

```bash
# 1. Clone and install
git clone <repo>
cd siteledger-backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env:
#   MONGODB_URI=mongodb://127.0.0.1:27017/siteledger
#   JWT_SECRET=any_long_random_string
#   SEED_SECRET=any_seed_secret

# 3. Run in dev mode (nodemon)
npm run dev

# Server starts at http://localhost:5000
# Health check: GET http://localhost:5000/health

# 4. (Optional) Seed demo data
curl -X POST http://localhost:5000/api/seed \
  -H "x-seed-secret: <your SEED_SECRET>"
```

---

## 15. Key Design Decisions

| Decision | Rationale |
|---|---|
| **orgId on every document** | Enables simple, fast multi-tenancy — all queries filter by `orgId`, no complex joins needed |
| **Mongoose 8** | No deprecated connection flags; async/await native; modern lean query support |
| **bcrypt salt rounds: 12** | Balance of security vs. performance for a construction SaaS |
| **`password: { select: false }`** | Password never returned unless explicitly `.select('+password')` — reduces accidental exposure |
| **Auto share% recalc** | `recalcShares()` called after every investor write — keeps share percentages always consistent without client computation |
| **Transaction in seed** | Atomicity — seed either completes fully or rolls back entirely |
| **`SITE-<timestamp>` code fallback** | Prevents missing-code errors while still keeping codes unique per org |
| **Stats via aggregation pipeline** | Single DB round-trip per resource type; O(1) Map lookups to build response — efficient even with many sites |
| **Members cannot self-register** | Security model — members are only created by owners/admins to prevent unauthorised access |
| **CORS credentials toggle** | `credentials: true` only when `CORS_ORIGIN` is not `*` — prevents browser security issues in production |
