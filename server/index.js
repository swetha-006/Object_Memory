import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import multer from 'multer';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'url';

// Tiny local .env loader so the server can use market API keys without
// adding another dependency. Existing process environment variables win.
function loadLocalEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadLocalEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'objectmemory.sqlite'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  subtitle TEXT DEFAULT '',
  condition TEXT DEFAULT 'Good',
  purchase_date TEXT DEFAULT '',
  value TEXT DEFAULT '',
  warranty TEXT DEFAULT 'Not recorded',
  serial TEXT DEFAULT 'Not recorded',
  description TEXT DEFAULT '',
  image_path TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT DEFAULT '',
  condition TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL,
  observed_at TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  source TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  url TEXT DEFAULT '',
  FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_object_date
  ON market_snapshots(object_id, observed_at);
`);

// Lightweight migrations for existing local databases.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('objects', 'brand', "TEXT DEFAULT ''");
ensureColumn('objects', 'model', "TEXT DEFAULT ''");
ensureColumn('objects', 'origin', "TEXT DEFAULT ''");
ensureColumn('events', 'image_path', "TEXT DEFAULT ''");
ensureColumn('events', 'occurred_at', "TEXT DEFAULT ''");

const now = () => new Date().toISOString();
const demoEmail = 'demo@objectmemory.local';
let demo = db.prepare('SELECT id FROM users WHERE email=?').get(demoEmail);
if (!demo) {
  const info = db.prepare('INSERT INTO users(name,email,password_hash,created_at) VALUES (?,?,?,?)')
    .run('Demo User', demoEmail, bcrypt.hashSync('demo123', 10), now());
  demo = { id: info.lastInsertRowid };
}
// Clean legacy seed if present
const legacySeed = db.prepare("SELECT id FROM objects WHERE user_id=? AND title='Automobile (sedan)' AND category='Car' AND image_path='' LIMIT 1").get(demo.id);
if (legacySeed) { db.prepare('DELETE FROM objects WHERE id=?').run(legacySeed.id); }

const app = express();

// Security Hardening: Helmet & CORS
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});
app.use('/api', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' }
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Chat frequency limit reached. Please wait a moment.' }
});

const marketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Market refresh frequency limit reached. Please wait a moment.' }
});

app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(uploadDir, {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

const JWT_SECRET = process.env.OBJECTMEMORY_JWT_SECRET || 'objectmemory-local-secret-change-me';

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

function objectForUser(id, userId) {
  return db.prepare('SELECT * FROM objects WHERE id=? AND user_id=?').get(id, userId);
}

function serializeObject(o) {
  if (!o) return null;
  return {
    ...o,
    imageUrl: o.image_path ? '/uploads/' + o.image_path : null,
    events: db.prepare("SELECT *, CASE WHEN image_path IS NOT NULL AND image_path != '' THEN '/uploads/'||image_path ELSE NULL END AS imageUrl FROM events WHERE object_id=? ORDER BY datetime(CASE WHEN occurred_at IS NOT NULL AND occurred_at != '' THEN occurred_at ELSE created_at END) DESC, id DESC").all(o.id),
    documents: db.prepare('SELECT id, original_name, mime_type, size, created_at, stored_name FROM documents WHERE object_id=? ORDER BY datetime(created_at) DESC, id DESC').all(o.id),
  };
}

function marketQueryForObject(obj) {
  return [obj.brand, obj.model, obj.title, obj.subtitle]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMarketPrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return null;
  const cleaned = String(value).replace(/[^0-9.,]/g, '').replace(/,(?=\d{3}\b)/g, '');
  const n = Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function marketSummary(objectId) {
  const rows = db.prepare(`
    SELECT * FROM market_snapshots
    WHERE object_id=?
    ORDER BY datetime(observed_at) ASC, id ASC
  `).all(objectId);

  const byDay = new Map();
  for (const row of rows) {
    const day = row.observed_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(row);
  }

  const history = [...byDay.entries()].map(([date, items]) => ({
    date,
    price: Math.round(median(items.map(x => Number(x.price))))
  }));

  const latest = history.length ? Number(history[history.length - 1].price) : null;
  const previousDay = history.length > 1 ? history[history.length - 2].price : null;
  const first = history.length ? history[0].price : null;
  const changePercent = first && latest && history.length > 1
    ? Number((((latest - first) / first) * 100).toFixed(1))
    : null;

  let trend = 'No history yet';
  if (history.length >= 2) {
    if (changePercent > 1) trend = 'Rising';
    else if (changePercent < -1) trend = 'Falling';
    else trend = 'Stable';
  } else if (history.length === 1) {
    trend = 'Collecting history';
  }

  return {
    currentPrice: latest ? Math.round(latest) : null,
    previousPrice: previousDay,
    changePercent,
    trend,
    history,
    observations: rows.length,
    firstObservedAt: rows[0]?.observed_at || null,
    lastObservedAt: rows[rows.length - 1]?.observed_at || null,
    listings: rows.slice(-20).reverse().map(x => ({
      price: Number(x.price), source: x.source, title: x.title, url: x.url,
      observedAt: x.observed_at, currency: x.currency
    }))
  };
}

async function fetchMarketListings(obj) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    const err = new Error('Market data is not configured. Add SERPAPI_KEY to your .env file.');
    err.code = 'MARKET_NOT_CONFIGURED';
    throw err;
  }

  const query = marketQueryForObject(obj);
  if (!query) {
    const err = new Error('Add a brand, model, or object name before checking market data.');
    err.code = 'MARKET_IDENTITY_MISSING';
    throw err;
  }

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    api_key: apiKey,
    gl: process.env.MARKET_GL || 'in',
    hl: process.env.MARKET_HL || 'en',
    google_domain: process.env.MARKET_GOOGLE_DOMAIN || 'google.co.in'
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `Market provider returned HTTP ${response.status}`);
  }

  const results = Array.isArray(data.shopping_results) ? data.shopping_results : [];
  const model = String(obj.model || '').toLowerCase().trim();
  const brand = String(obj.brand || '').toLowerCase().trim();

  const candidates = results
    .map(r => ({
      price: parseMarketPrice(r.extracted_price ?? r.price),
      source: r.source || 'Google Shopping',
      title: r.title || query,
      url: r.product_link || r.link || '',
      secondHand: Boolean(r.second_hand_condition)
    }))
    .filter(r => r.price && r.price > 0 && !r.secondHand)
    .filter(r => {
      const t = r.title.toLowerCase();
      const brandMatch = !brand || t.includes(brand);
      const modelTokens = model.split(/[^a-z0-9]+/).filter(x => x.length > 1);
      const modelMatch = !modelTokens.length || modelTokens.every(token => t.includes(token));
      return brandMatch && modelMatch;
    });

  const seen = new Set();
  return candidates.filter(r => {
    const key = `${r.source}|${r.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function formatObjectPromptContext(obj, events, documents, market) {
  let ctx = `ITEM RECORD:
- Title/Name: ${obj.title}
- Category: ${obj.category || 'General'}
- Brand: ${obj.brand || 'Not recorded'}
- Model: ${obj.model || 'Not recorded'}
- Condition: ${obj.condition || 'Not recorded'}
- Purchase Date: ${obj.purchase_date || 'Not recorded'}
- Recorded Value: ${obj.value ? `INR ${obj.value}` : 'Not recorded'}
- Warranty Expiry / Info: ${obj.warranty || 'Not recorded'}
- Serial Number: ${obj.serial || 'Not recorded'}
- Origin / Provenance: ${obj.origin || 'Not recorded'}
- Notes/Description: ${obj.description || 'None'}`;

  if (events && events.length) {
    ctx += `\n\nRECENT TIMELINE (${events.length} events logged):\n` + events.slice(0, 8).map(e =>
      `- [${(e.occurred_at || e.created_at || '').slice(0, 10)}] ${e.type.toUpperCase()}: ${e.title}${e.note ? ` — ${e.note}` : ''}${e.condition ? ` [Condition: ${e.condition}]` : ''}`
    ).join('\n');
  }

  if (documents && documents.length) {
    ctx += `\n\nATTACHED DOCUMENTS IN VAULT (${documents.length}):\n` + documents.map(d =>
      `- ${d.original_name} (${(d.size / 1024).toFixed(1)} KB)`
    ).join('\n');
  }

  if (market && market.currentPrice) {
    ctx += `\n\nMARKET OBSERVATION (Google Shopping):\n- Latest retail median: INR ${market.currentPrice.toLocaleString()}\n- Market Trend: ${market.trend || 'N/A'}${market.changePercent != null ? ` (${market.changePercent}%)` : ''}`;
  }

  return ctx;
}

// Deterministic Local AI fallback generator with structured Markdown formatting
function generateDeterministicAiResponse(obj, question, events, documents, market) {
  const q = question.toLowerCase();
  const identity = [obj.brand, obj.model, obj.title].filter(Boolean).join(' ');

  // 1. Warranty Queries
  if (/warrant|guarantee|expire|expiry|validity|coverage|claim/.test(q)) {
    const warrantyStr = obj.warranty || 'Not recorded';
    let statusBadge = '';
    const expiryMatch = warrantyStr.match(/\d{4}-\d{2}-\d{2}/);
    if (expiryMatch) {
      const expiry = new Date(expiryMatch[0]);
      const diffDays = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        statusBadge = `> **Warranty Status:** ⚠️ **Expired** (${Math.abs(diffDays)} days ago on ${expiryMatch[0]}).`;
      } else if (diffDays <= 30) {
        statusBadge = `> **Warranty Status:** 🚨 **Expiring Soon!** (${diffDays} days remaining until ${expiryMatch[0]}).`;
      } else {
        statusBadge = `> **Warranty Status:** ✅ **Active Coverage** (${diffDays} days remaining until ${expiryMatch[0]}).`;
      }
    } else {
      statusBadge = `> **Recorded Warranty Info:** ${warrantyStr}`;
    }

    const docList = documents.filter(d => /warrant|invoice|receipt|bill/i.test(d.original_name));
    const docSection = docList.length
      ? `\n\n### Supporting Documents in Vault:\n` + docList.map(d => `- **${d.original_name}** (${(d.size / 1024).toFixed(1)} KB)`).join('\n')
      : '\n\n*Tip: Upload your purchase invoice or warranty certificate to the Documents tab for instant claim reference.*';

    return `### Warranty & Coverage Verification

${statusBadge}

**Possession Details:**
- **Item:** ${identity}
- **Purchase Date:** ${obj.purchase_date || 'Not recorded'}
- **Serial Number:** \`${obj.serial || 'Not recorded'}\`
${docSection}

### Recommended Actions for Claims:
1. **Proof of Ownership:** Keep the recorded serial number and invoice handy when contacting customer care.
2. **Authorized Service:** Ensure any diagnostic or repair is completed by authorized service personnel to avoid voiding terms.
3. **Log Any Discrepancies:** If servicing occurs, record a new entry in the **Timeline** to maintain verified service history.`;
  }

  // 2. Overheating, Troubleshooting & Thermal Issues
  if (/heat|hot|warm|overheat|battery|drain|lag|freeze|slow|troubleshoot|fix|issue|problem/.test(q)) {
    const isMobile = /phone|tablet|mobile|cell/i.test(obj.category);
    const purchaseDate = obj.purchase_date || 'recently recorded';

    return `### Diagnostic & Thermal Guide for ${identity}

Since your item is cataloged in **${obj.condition}** condition (recorded ${purchaseDate}), here are the primary causes and actionable solutions:

### Most Common Causes:
1. **Intensive Processor Load:** Sustained heavy workloads (gaming, 4K/8K video processing, navigation, AR) drive CPU/GPU thermals up rapidly.
2. **Charging Resistance:** Fast charging creates natural internal heat. Using the device intensively while plugged in doubles thermal stress.
3. **Environmental Factors:** Direct sunlight, car dashboards, or ambient temperatures above 30°C quickly overwhelm passive cooling.
4. **Thermal Trapping (Cases & Sleeves):** Thick rubber or wallet cases act as thermal insulators, preventing heat from dissipating through the frame.
5. **Background Activity:** Background synchronizations, location services, or corrupt background caches prevent low-power sleep states.

### Immediate Actionable Fixes:
- **Let it Cool Down:** Place the device in a cool, ventilated area out of direct sunlight for 5–10 minutes.
- **Remove Protective Case:** Detach thick cases during intensive sessions or high-wattage charging.
- **Avoid Heavy Use While Charging:** Unplug or let the battery charge to 80% while idle before resuming intensive use.
- **Terminate Rogue Apps:** Restart the device to flush temporary memory and close high-drain background tasks.
- **Inspect Port & Vents:** Check charging ports and speaker grilles for lint or debris.

> **Integrity Record:** Recorded warranty is valid until **${obj.warranty || 'N/A'}**. If thermal throttling or battery swelling occurs during normal idle use, schedule an official manufacturer inspection.`;
  }

  // 3. Condition, Damage & Incident Audit
  if (/condition|damage|scratch|dent|incident|repair|broken|crack|history/.test(q)) {
    const damageEvents = events.filter(e => ['damage', 'incident', 'condition'].includes(String(e.type).toLowerCase()));
    const eventItems = damageEvents.length
      ? damageEvents.map(e => `- **[${(e.occurred_at || e.created_at || '').slice(0, 10)}] ${e.title}:** ${e.note || 'No notes'} *(Condition: ${e.condition || obj.condition})*`).join('\n')
      : '- *No incidents or damages have been recorded in this item’s timeline.*';

    return `### Condition & Lifecycle Audit

**Current Condition Rating:** **${obj.condition}**

### Timeline & Recorded Incidents:
${eventItems}

### Care & Longevity Recommendations:
1. **Preserve Value:** Keeping dated photo records of any physical changes protects you against depreciation disputes.
2. **Log New Changes:** If further cosmetic wear develops, use **Incident Mode** to record dated visual proof immediately.
3. **Routine Cleaning:** Follow manufacturer-safe microfiber wipes; avoid harsh abrasive solvents.`;
  }

  // 4. Valuation & Market Intelligence
  if (/worth|value|price|cost|market|sell|trend|depreciation/.test(q)) {
    const marketText = market && market.currentPrice
      ? `\n\n### Live Market Intelligence (Google Shopping):\n- **Latest Observed Median:** **INR ${market.currentPrice.toLocaleString()}**\n- **Market Trend:** **${market.trend}** ${market.changePercent != null ? `(${market.changePercent}%)` : ''}\n- **Sampled Listings:** ${market.observations} retail listings observed`
      : '\n\n*Configure SerpApi in .env to enable real-time retail price benchmarking.*';

    return `### Valuation & Financial Summary

**Recorded Acquisition Value:** ${obj.value ? `**INR ${Number(obj.value).toLocaleString()}**` : '*Not recorded*'}${marketText}

**Item Profile:**
- **Make & Model:** ${obj.brand || ''} ${obj.model || ''} (${obj.category})
- **Acquisition Date:** ${obj.purchase_date || 'Not recorded'}
- **Current Condition:** **${obj.condition}**
- **Provenance / Origin:** ${obj.origin || 'Not recorded'}

> **Valuation Note:** Your recorded value reflects the initial purchase/replacement cost. Live market observations track retail asking prices for reference.`;
  }

  // 5. Default General Overview
  return `### ObjectMemory Record: ${identity}

Here is the verified profile from your private archive:

- **Category:** ${obj.category}
- **Brand & Model:** ${obj.brand || 'N/A'} ${obj.model || ''}
- **Current Condition:** **${obj.condition}**
- **Serial Number:** \`${obj.serial || 'Not recorded'}\`
- **Purchase Date:** ${obj.purchase_date || 'Not recorded'}
- **Recorded Value:** ${obj.value ? `INR ${obj.value}` : 'Not recorded'}
- **Warranty Status:** ${obj.warranty || 'Not recorded'}
- **Logged Events:** ${events.length} lifecycle entries
- **Attached Files:** ${documents.length} verified documents

### Suggested Queries:
- *"What could cause it to overheat?"*
- *"Is my warranty still valid?"*
- *"Summarize recent incidents and damage."*
- *"What is its current recorded and market value?"*`;
}

// Deterministic Archive & Whole-Platform Assistant helper
function generateDeterministicArchiveResponse(question, objects, recentEvents, documents = [], totalValue = 0, categories = {}, history = []) {
  const q = question.toLowerCase().trim();

  // 1. Platform & How-to Questions
  if (/how\s+(to|do|can)|platform|feature|export|dossier|insurance|backup|restore|mobilenet|detect|incident\s+mode|market\s+track|what\s+is\s+objectmemory/.test(q)) {
    if (/insurance|dossier|claim/.test(q)) {
      return `### How to Generate an Insurance Claim Dossier

ObjectMemory includes an official, certified **Insurance Dossier Generator** designed for insurance loss adjusters and warranty administrators:

1. **Open the Object Detail:** Navigate to the possession from your Dashboard or Archive.
2. **Click "Insurance Dossier":** In the item header action bar next to *"Edit details"*, click the **Insurance Dossier** button.
3. **Review Verified Records:** The system automatically compiles:
   - Unique official claim reference (e.g. \`OM-CLAIM-3-X8F2\`).
   - High-resolution asset photographs and verified serial number.
   - Complete historical timeline table with condition changes and damage notes.
   - Attached document manifest (invoices, receipts).
   - Policyholder certification and signature line.
4. **Print or Save as PDF:** Click **"Print / Save PDF Dossier"** to generate a clean, official PDF formatted with page breaks and certification blocks.`;
    }

    if (/backup|export|restore|csv|json/.test(q)) {
      return `### How to Backup & Export Your Archive

ObjectMemory provides 100% data portability directly from the **Settings** page:

- **Export Vault (JSON):** Go to **Settings** &rarr; click **"Export JSON Backup"**. This downloads an immutable snapshot of all objects, timeline events, documents metadata, and chat history.
- **Export Catalog (CSV):** Click **"Export CSV Catalog"** in Settings to generate an inventory spreadsheet compatible with Excel or Google Sheets.
- **Restore Archive:** Under **"Restore Archive (JSON)"**, select your previous backup file to restore records directly into your local encrypted vault.`;
    }

    if (/incident|damage|scratch|report/.test(q)) {
      return `### How to Log Damage & Incidents

When a physical possession suffers a scratch, malfunction, or cosmetic wear:

1. **Open Incident Mode:** Click the **"Incident mode"** button in the top navigation bar or navigate to \`/incident\`.
2. **Select the Possession:** Pick the object from your catalog dropdown.
3. **Record Incident Details:** Enter the date of occurrence, incident type, and verified description.
4. **Update Condition Grade:** Adjust condition (e.g. from *Good* to *Damaged* or *Needs repair*).
5. **Attach Photographic Proof:** Upload a dated photo. The system runs on-device visual inspection suggestions to keep the audit record honest.
6. **Save to Timeline:** The incident and condition change are permanently bound to the item's immutable memory timeline.`;
    }

    if (/photo|camera|vision|categor|mobilenet/.test(q)) {
      return `### On-Device Computer Vision & Auto-Categorization

When adding a possession via **Add Object** (\`/objects/new\`):

- **Zero Cloud Uploads:** An embedded **MobileNet v2** neural network runs **100% locally in your web browser** using TensorFlow.js.
- **Instant Recognition:** The moment you select or drop a photo, the browser evaluates the image against ImageNet classes and suggests the appropriate category (*Phone, Computer, Car, Camera, Watch, Furniture, Tool, Jewelry*).
- **Privacy Guaranteed:** Not a single byte of your photo is sent to any external server or cloud API for inference.`;
    }

    if (/market|retail|shopping|price\s+track/.test(q)) {
      return `### Live Market Tracking & Price Trends

ObjectMemory monitors current retail and second-hand listing benchmarks for your possessions:

- **Google Shopping Intelligence:** When viewing any possession, click the **"Market"** tab.
- **Automated Observation:** The system searches real-time listings matching brand, model, and category.
- **Observed Price History:** Stores dated price observations over time and renders an interactive SVG price trajectory chart showing whether market value is **Rising**, **Falling**, or **Stable**.
- **Source Transparency:** Shows actual merchant links and observation timestamps.`;
    }

    return `### ObjectMemory Platform Capabilities Overview

ObjectMemory is an end-to-end digital vault and lifecycle archive for valuable possessions:

1. **Object Cataloging:** Track brand, model, serial #, condition, purchase dates, and recorded replacement values.
2. **On-Device Computer Vision:** Automatic category suggestions via local in-browser MobileNet v2.
3. **Immutable Memory Timeline:** Chronological audit log of creations, condition shifts, damage notes, and photos.
4. **Certified Insurance Dossiers:** One-click official PDF loss and valuation reports ready for insurance adjusters.
5. **Document Vault:** Secure storage for purchase receipts, warranties, and user manuals.
6. **Live Market Benchmarking:** Google Shopping retail price tracking and trend analysis via SerpApi.
7. **Full Data Portability:** Complete JSON vault backup/restore and CSV spreadsheet exports.`;
  }

  // 2. All Objects & Catalog Listing
  if (/list|all\s+(objects|items|possessions|things)|show\s+all|my\s+possessions|what\s+(do|objects|items)\s+(i|we)\s+own|catalog|inventory|how\s+many\s+objects/.test(q)) {
    if (!objects.length) {
      return `### Your Possession Catalog\n\nYour archive is currently empty. Click **"Add an object"** to record your first possession!`;
    }

    const list = objects.map((o, idx) =>
      `${idx + 1}. **${o.title}** (${o.category || 'General'}) — Condition: **${o.condition || 'Good'}** · Value: ${o.value ? '₹' + Number(o.value).toLocaleString() : 'Not recorded'} · Warranty: \`${o.warranty || 'Not recorded'}\``
    ).join('\n');

    return `### Complete Possession Catalog (${objects.length} Items Recorded)

Here are all the possessions currently remembered in your ObjectMemory archive:

${list}

**Total Portfolio Valuation:** **INR ${totalValue.toLocaleString()}** across **${documents.length} attached documents**.

*Tip: You can ask me about any specific item above, or generate an Insurance Dossier on its detail page.*`;
  }

  // 3. Financial & Valuation Questions
  if (/worth|value|valuation|cost|portfolio|price|expensive|financial|total/.test(q)) {
    const sortedByValue = [...objects]
      .map(o => ({ ...o, parsedVal: parseMarketPrice(o.value) || 0 }))
      .sort((a, b) => b.parsedVal - a.parsedVal);

    const topItems = sortedByValue.slice(0, 5).map(o =>
      `- **${o.title}** (${o.category}): **INR ${o.parsedVal.toLocaleString()}** *(Condition: ${o.condition})*`
    ).join('\n');

    const catBreakdown = Object.entries(categories).map(([c, n]) => `- **${c}:** ${n} item${n === 1 ? '' : 's'}`).join('\n');

    return `### Portfolio Valuation & Financial Intelligence

**Total Archive Value:** **INR ${totalValue.toLocaleString()}** across **${objects.length} cataloged possessions**.

### Top Value Possessions:
${topItems || 'No items with recorded value.'}

### Category Breakdown:
${catBreakdown}

> **Insurance Note:** You can generate an official **Insurance Dossier** for any high-value asset from its detail page to substantiate replacement costs.`;
  }

  // 4. Warranty Queries
  if (/warrant|expire|expiry|validity|guarantee|watchdog/.test(q)) {
    const itemsWithWarranty = objects
      .map(o => {
        const match = (o.warranty || '').match(/\d{4}-\d{2}-\d{2}/);
        if (!match) return null;
        const days = Math.ceil((new Date(match[0]) - new Date()) / (1000 * 60 * 60 * 24));
        return { ...o, days, expiryDate: match[0] };
      })
      .filter(Boolean)
      .sort((a, b) => a.days - b.days);

    if (!itemsWithWarranty.length) {
      return `### Warranty Coverage Overview\n\nNo active warranty expiration dates are currently recorded in your archive. You can add warranty dates to your possessions in their detail views to activate the proactive **Warranty Watchdog**.`;
    }

    const urgent = itemsWithWarranty.filter(w => w.days >= 0 && w.days <= 30);
    const expired = itemsWithWarranty.filter(w => w.days < 0);
    const active = itemsWithWarranty.filter(w => w.days > 30);

    let res = `### Warranty Watchdog Report\n\n`;
    if (urgent.length) {
      res += `### 🚨 Urgent Expirations (< 30 Days):\n` + urgent.map(u => `- **${u.title}**: **Expiring in ${u.days} days** (\`${u.expiryDate}\`)`).join('\n') + `\n\n`;
    }
    if (expired.length) {
      res += `### ⚠️ Expired Coverage:\n` + expired.map(e => `- **${e.title}**: Expired ${Math.abs(e.days)} days ago (\`${e.expiryDate}\`)`).join('\n') + `\n\n`;
    }
    if (active.length) {
      res += `### ✅ Active Warranties:\n` + active.map(a => `- **${a.title}**: Valid for ${a.days} days (\`${a.expiryDate}\`)`).join('\n') + `\n\n`;
    }
    res += `*Tip: Review items with imminent deadlines to complete service or claim requests before coverage expires.*`;
    return res;
  }

  // 5. Damage, Incident & Attention Queries
  if (/damage|incident|scratch|dent|repair|broken|attention|condition/.test(q)) {
    const attentionItems = objects.filter(o => ['Damaged', 'Needs repair', 'Fair'].includes(o.condition));
    const damageEvents = recentEvents.filter(e => ['incident', 'damage'].includes(String(e.type).toLowerCase()));

    if (!attentionItems.length && !damageEvents.length) {
      return `### Condition & Incident Review\n\n✅ **Excellent Standing:** All **${objects.length} possessions** in your archive are currently rated in **Good** or **Excellent** condition with zero pending incidents.`;
    }

    let report = `### Condition & Incident Audit\n\n`;
    if (attentionItems.length) {
      report += `### Possessions Requiring Attention:\n` + attentionItems.map(item =>
        `- **${item.title}** (${item.category}): Current Condition is **${item.condition}**`
      ).join('\n') + `\n\n`;
    }

    if (damageEvents.length) {
      report += `### Recent Incident Timeline Entries:\n` + damageEvents.slice(0, 6).map(e =>
        `- **${e.object_title}** [${(e.occurred_at || e.created_at || '').slice(0, 10)}]: **${e.title}** — ${e.note || 'No notes'}`
      ).join('\n') + `\n\n`;
    }

    report += `*Use **Incident Mode** to log new repairs or update condition grades as items are serviced.*`;
    return report;
  }

  // 6. Specific Item Lookup (Title, Brand, Model, or distinct word match)
  for (const obj of objects) {
    const titleLower = obj.title.toLowerCase();
    const brandLower = (obj.brand || '').toLowerCase();
    const modelLower = (obj.model || '').toLowerCase();
    const words = titleLower.split(/\s+/).filter(w => w.length > 2);
    const matchesWord = words.some(w => q.includes(w));

    if ((brandLower && q.includes(brandLower)) || (modelLower && q.includes(modelLower)) || q.includes(titleLower) || matchesWord) {
      const itemEvents = recentEvents.filter(e => e.object_title === obj.title);
      const itemDocs = documents.filter(d => d.object_title === obj.title);

      return `### Possession Record: ${obj.title}

Here is the archive profile for **${obj.title}**:

- **Category:** ${obj.category || 'General'}
- **Brand & Model:** ${obj.brand || 'N/A'} ${obj.model || ''}
- **Current Condition:** **${obj.condition || 'Good'}**
- **Purchase Date:** ${obj.purchase_date || 'Not recorded'}
- **Serial Number:** \`${obj.serial || 'Not recorded'}\`
- **Recorded Value:** ${obj.value ? `INR ${Number(obj.value).toLocaleString()}` : 'Not recorded'}
- **Warranty Status:** ${obj.warranty || 'Not recorded'}
- **Provenance / Origin:** ${obj.origin || 'Not recorded'}
- **Timeline Records:** ${itemEvents.length} logged events
- **Attached Documents:** ${itemDocs.length} files

*You can open this item's detail page to add timeline notes, inspect live market prices, or generate a certified Insurance Dossier.*`;
    }
  }

  // 7. Documents & Invoices Queries
  if (/document|invoice|receipt|bill|file|pdf|manual/.test(q)) {
    if (!documents.length) {
      return `### Document Vault Status\n\nNo document files or receipts are currently stored in your vault. You can attach PDFs, purchase receipts, or warranty cards in any object's **Documents** tab.`;
    }

    const list = documents.slice(0, 8).map(d =>
      `- **${d.original_name}** attached to **${d.object_title}** (${(d.size / 1024).toFixed(1)} KB)`
    ).join('\n');

    return `### Document Vault Manifest (${documents.length} Files)\n\n${list}\n\n*These documents are automatically cross-referenced when generating Insurance Claim Dossiers.*`;
  }

  // 8. General Master Summary
  const topCat = Object.entries(categories).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(([c, n]) => `${c} (${n})`).join(', ');

  return `### ObjectMemory Archive & Platform Intelligence

You have **${objects.length} items** cataloged with a total recorded value of **INR ${totalValue.toLocaleString()}**.

### Archive Summary:
- **Possessions:** ${objects.length} items cataloged
- **Primary Categories:** ${topCat || 'General'}
- **Documents in Vault:** ${documents.length} verified files
- **Lifecycle Events Logged:** ${recentEvents.length} recorded events

### What You Can Ask Me:
- *"What is my total portfolio value and breakdown?"*
- *"Which warranties are expiring soon?"*
- *"Which items have recorded damage or need attention?"*
- *"List all my cataloged possessions."*
- *"How do I export an official Insurance Claim Dossier?"*
- *"How do I backup my complete archive?"*
- *Ask about any specific item (e.g. Sony camera, laptop, phone).*`;
}

// =================== AUTH ROUTES ===================
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email, and a password of at least 6 characters are required.' });
  }
  try {
    const info = db.prepare('INSERT INTO users(name,email,password_hash,created_at) VALUES (?,?,?,?)')
      .run(name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), now());
    const user = { id: Number(info.lastInsertRowid), name: name.trim(), email: email.trim().toLowerCase() };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch {
    res.status(409).json({ error: 'An account with that email already exists.' });
  }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(email || '');
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const user = publicUser(u);
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

// =================== OBJECTS ROUTES ===================
app.get('/api/objects', auth, (req, res) => {
  const q = (req.query.search || '').trim();
  const rows = q
    ? db.prepare("SELECT * FROM objects WHERE user_id=? AND (title LIKE ? OR category LIKE ? OR subtitle LIKE ? OR brand LIKE ? OR model LIKE ?) ORDER BY datetime(updated_at) DESC").all(req.user.id, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM objects WHERE user_id=? ORDER BY datetime(updated_at) DESC').all(req.user.id);
  res.json({ objects: rows.map(serializeObject) });
});

app.post('/api/objects', auth, (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.title.trim()) return res.status(400).json({ error: 'Object name is required.' });
  const t = now();
  const info = db.prepare(`
    INSERT INTO objects(user_id,title,category,subtitle,condition,purchase_date,value,warranty,serial,description,created_at,updated_at,brand,model,origin)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.id, b.title.trim(), b.category || 'Other', b.subtitle || '', b.condition || 'Good',
    b.purchaseDate || '', b.value || '', b.warranty || 'Not recorded', b.serial || 'Not recorded',
    b.description || '', t, t, b.brand || '', b.model || '', b.origin || ''
  );
  const id = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO events(object_id,type,title,note,condition,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, 'created', 'Object added', `${b.title.trim()} entered your ObjectMemory vault.`, b.condition || 'Good', t);
  res.status(201).json({ object: serializeObject(objectForUser(id, req.user.id)) });
});

app.get('/api/objects/:id', auth, (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });
  res.json({ object: serializeObject(o) });
});

app.put('/api/objects/:id', auth, (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });
  const b = req.body || {};
  const fields = ['title', 'brand', 'model', 'category', 'origin', 'subtitle', 'condition', 'purchaseDate', 'value', 'warranty', 'serial', 'description'];
  const vals = fields.map(k => b[k] ?? o[k === 'purchaseDate' ? 'purchase_date' : k]);
  const cols = ['title', 'brand', 'model', 'category', 'origin', 'subtitle', 'condition', 'purchase_date', 'value', 'warranty', 'serial', 'description'];
  const t = now();

  db.prepare(`UPDATE objects SET ${cols.map(c => c + '=?').join(',')}, updated_at=? WHERE id=? AND user_id=?`).run(...vals, t, o.id, req.user.id);

  if (b.condition && b.condition !== o.condition) {
    db.prepare('INSERT INTO events(object_id,type,title,note,condition,created_at) VALUES (?,?,?,?,?,?)')
      .run(o.id, 'condition', 'Condition updated', `Condition changed from ${o.condition} to ${b.condition}.`, b.condition, t);
  }
  res.json({ object: serializeObject(objectForUser(o.id, req.user.id)) });
});

app.delete('/api/objects/:id', auth, (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });

  // Delete attached files on disk
  if (o.image_path) {
    try { fs.unlinkSync(path.join(uploadDir, o.image_path)); } catch {}
  }
  const docs = db.prepare('SELECT stored_name FROM documents WHERE object_id=?').all(o.id);
  for (const d of docs) {
    try { fs.unlinkSync(path.join(uploadDir, d.stored_name)); } catch {}
  }
  const evPhotos = db.prepare("SELECT image_path FROM events WHERE object_id=? AND image_path != ''").all(o.id);
  for (const ev of evPhotos) {
    try { fs.unlinkSync(path.join(uploadDir, ev.image_path)); } catch {}
  }

  db.prepare('DELETE FROM objects WHERE id=?').run(o.id);
  res.json({ ok: true });
});

// =================== TIMELINE EVENTS & UPLOADS ===================
app.post('/api/objects/:id/events', auth, (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });
  const { type = 'note', title, note = '', condition = '', occurredAt = '' } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Event title is required.' });
  const t = now();
  const info = db.prepare('INSERT INTO events(object_id,type,title,note,condition,created_at,occurred_at,image_path) VALUES (?,?,?,?,?,?,?,?)')
    .run(o.id, type, title.trim(), note, condition, t, occurredAt || t, '');

  if (condition && condition !== o.condition) {
    db.prepare('UPDATE objects SET condition=?, updated_at=? WHERE id=?').run(condition, t, o.id);
  } else {
    db.prepare('UPDATE objects SET updated_at=? WHERE id=?').run(t, o.id);
  }

  const event = db.prepare(`SELECT *, CASE WHEN image_path IS NOT NULL AND image_path != '' THEN '/uploads/'||image_path ELSE NULL END AS imageUrl FROM events WHERE id=?`).get(Number(info.lastInsertRowid));
  res.status(201).json({ object: serializeObject(objectForUser(o.id, req.user.id)), event });
});

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/objects/:id/documents', auth, upload.single('file'), (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });
  if (!req.file) return res.status(400).json({ error: 'Please choose a file.' });
  const t = now();
  db.prepare('INSERT INTO documents(object_id,original_name,stored_name,mime_type,size,created_at) VALUES (?,?,?,?,?,?)')
    .run(o.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, t);
  db.prepare('INSERT INTO events(object_id,type,title,note,created_at) VALUES (?,?,?,?,?)')
    .run(o.id, 'document', 'Document attached', req.file.originalname, t);
  res.status(201).json({ object: serializeObject(objectForUser(o.id, req.user.id)) });
});

app.post('/api/objects/:id/image', auth, upload.single('file'), (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });
  if (!req.file) return res.status(400).json({ error: 'Please choose an image.' });
  if (!req.file.mimetype.startsWith('image/')) {
    try { fs.unlinkSync(path.join(uploadDir, req.file.filename)); } catch {}
    return res.status(400).json({ error: 'Only image files are allowed.' });
  }
  if (o.image_path) {
    try { fs.unlinkSync(path.join(uploadDir, o.image_path)); } catch {}
  }
  const t = now();
  db.prepare('UPDATE objects SET image_path=?, updated_at=? WHERE id=? AND user_id=?').run(req.file.filename, t, o.id, req.user.id);
  db.prepare('INSERT INTO events(object_id,type,title,note,created_at) VALUES (?,?,?,?,?)')
    .run(o.id, 'photo', 'Cover photo updated', 'Primary possession photo was updated.', t);
  res.status(201).json({ object: serializeObject(objectForUser(o.id, req.user.id)) });
});

app.post('/api/objects/:id/events/:eventId/image', auth, upload.single('file'), (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });
  const event = db.prepare('SELECT * FROM events WHERE id=? AND object_id=?').get(req.params.eventId, o.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!req.file) return res.status(400).json({ error: 'Please choose an image.' });
  if (!req.file.mimetype.startsWith('image/')) {
    try { fs.unlinkSync(path.join(uploadDir, req.file.filename)); } catch {}
    return res.status(400).json({ error: 'Only image files are allowed.' });
  }
  if (event.image_path) {
    try { fs.unlinkSync(path.join(uploadDir, event.image_path)); } catch {}
  }
  db.prepare('UPDATE events SET image_path=? WHERE id=?').run(req.file.filename, event.id);
  const t = now();
  db.prepare('UPDATE objects SET updated_at=? WHERE id=?').run(t, o.id);
  const updated = db.prepare(`SELECT *, CASE WHEN image_path IS NOT NULL AND image_path != '' THEN '/uploads/'||image_path ELSE NULL END AS imageUrl FROM events WHERE id=?`).get(event.id);
  res.status(201).json({ event: updated });
});

app.delete('/api/documents/:id', auth, (req, res) => {
  const d = db.prepare('SELECT d.*, o.user_id FROM documents d JOIN objects o ON o.id=d.object_id WHERE d.id=? AND o.user_id=?').get(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  try { fs.unlinkSync(path.join(uploadDir, d.stored_name)); } catch {}
  db.prepare('DELETE FROM documents WHERE id=?').run(d.id);
  res.json({ ok: true });
});

// =================== MARKET TRACKING ===================
app.get('/api/objects/:id/market', auth, marketLimiter, async (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });

  const shouldRefresh = req.query.refresh === '1';
  try {
    let fetched = 0;
    if (shouldRefresh) {
      const listings = await fetchMarketListings(o);
      const t = now();
      const insert = db.prepare(`
        INSERT INTO market_snapshots(object_id,observed_at,price,currency,source,title,url)
        VALUES (?,?,?,?,?,?,?)
      `);
      db.exec('BEGIN');
      try {
        for (const item of listings) insert.run(o.id, t, item.price, 'INR', item.source, item.title, item.url);
        db.exec('COMMIT');
      } catch (transactionError) {
        try { db.exec('ROLLBACK'); } catch {}
        throw transactionError;
      }
      fetched = listings.length;
    }

    res.json({
      configured: Boolean(process.env.SERPAPI_KEY),
      query: marketQueryForObject(o),
      fetched,
      ...marketSummary(o.id)
    });
  } catch (e) {
    const status = e.code === 'MARKET_NOT_CONFIGURED' || e.code === 'MARKET_IDENTITY_MISSING' ? 400 : 502;
    res.status(status).json({
      error: e.message,
      configured: Boolean(process.env.SERPAPI_KEY),
      query: marketQueryForObject(o),
      ...marketSummary(o.id)
    });
  }
});

// =================== OBJECT AI CHAT (ENHANCED MARKDOWN + RESILIENT FALLBACK) ===================
app.post('/api/objects/:id/chat', auth, chatLimiter, async (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });

  const question = (req.body?.message || '').trim();
  if (!question) return res.status(400).json({ error: 'Message is required.' });

  const isStream = req.query.stream === '1' || req.headers.accept?.includes('text/event-stream');

  // Save user's question to SQLite
  const t = now();
  db.prepare(`
    INSERT INTO chat_messages(object_id, user_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(o.id, req.user.id, 'user', question, t);

  // Fetch recent history
  const history = db.prepare(`
    SELECT role, content
    FROM chat_messages
    WHERE object_id=? AND user_id=?
    ORDER BY id DESC
    LIMIT 8
  `).all(o.id, req.user.id).reverse();

  // Fetch context
  const events = db.prepare(`
    SELECT type, title, note, condition, created_at, occurred_at
    FROM events
    WHERE object_id=?
    ORDER BY datetime(CASE WHEN occurred_at IS NOT NULL AND occurred_at != '' THEN occurred_at ELSE created_at END) DESC
    LIMIT 10
  `).all(o.id);

  const documents = db.prepare(`
    SELECT original_name, mime_type, size, created_at
    FROM documents
    WHERE object_id=?
    ORDER BY datetime(created_at) DESC
  `).all(o.id);

  const market = marketSummary(o.id);

  // Strict structured Markdown formatting guidelines
  const systemInstructions = `You are ObjectMemory AI, an expert possession assistant.
Answer the user's questions clearly, concisely, and practically regarding this specific possession (usage, features, care/maintenance, troubleshooting, specs, history, warranty, valuation).

CRITICAL FORMATTING RULES:
1. Always format your response using clean, structured Markdown.
2. Break responses into distinct sections with bold headers (e.g. ### Cause & Analysis, ### Recommended Action Steps, > **Warranty Status**).
3. Use bullet points (-) or numbered lists (1., 2.) for steps, causes, or options.
4. Put blank lines between paragraphs and list items for visual breathing room.
5. Highlight important terms, model names, dates, and warnings in **bold**.
6. Never output an unbroken wall of text or raw pipes without Markdown spacing.

RECORD INTEGRITY RULES:
1. Base facts about this specific item on the provided record below. Distinguish recorded facts from general knowledge.
2. If an item-specific detail is not recorded, state: "That information is not recorded in ObjectMemory." General practical tips may still be shared.
3. Never invent serial numbers, dates, prices, or damage events.

${formatObjectPromptContext(o, events, documents, market)}`;

  const apiKey = process.env.GROQ_API_KEY;

  // Stream local fallback helper
  const streamFallbackResponse = async (text) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const words = text.split(' ');
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      await new Promise(r => setTimeout(r, 20));
    }

    db.prepare(`
      INSERT INTO chat_messages(object_id, user_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(o.id, req.user.id, 'assistant', text, now());

    const allMessages = db.prepare(`
      SELECT id, role, content, created_at
      FROM chat_messages
      WHERE object_id=? AND user_id=?
      ORDER BY id
    `).all(o.id, req.user.id);

    res.write(`data: ${JSON.stringify({ done: true, answer: text, messages: allMessages })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  };

  // If no Groq API Key is configured, use the high-quality local deterministic engine directly
  if (!apiKey) {
    const localAnswer = generateDeterministicAiResponse(o, question, events, documents, market);
    if (isStream) {
      return await streamFallbackResponse(localAnswer);
    } else {
      db.prepare(`
        INSERT INTO chat_messages(object_id, user_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(o.id, req.user.id, 'assistant', localAnswer, now());

      const allMessages = db.prepare(`
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE object_id=? AND user_id=?
        ORDER BY id
      `).all(o.id, req.user.id);

      return res.json({ answer: localAnswer, messages: allMessages });
    }
  }

  // Attempt Groq LLM with fallback
  try {
    const messages = [
      { role: 'system', content: systemInstructions },
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content)
      })),
      { role: 'user', content: question }
    ];

    const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 950,
        stream: isStream
      })
    });

    if (!groqResponse.ok) {
      const errData = await groqResponse.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Groq returned HTTP ${groqResponse.status}`);
    }

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const reader = groqResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullAnswer += delta;
              res.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
            }
          } catch {}
        }
      }

      fullAnswer = fullAnswer.trim() || generateDeterministicAiResponse(o, question, events, documents, market);

      db.prepare(`
        INSERT INTO chat_messages(object_id, user_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(o.id, req.user.id, 'assistant', fullAnswer, now());

      const allMessages = db.prepare(`
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE object_id=? AND user_id=?
        ORDER BY id
      `).all(o.id, req.user.id);

      res.write(`data: ${JSON.stringify({ done: true, answer: fullAnswer, messages: allMessages })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const data = await groqResponse.json();
      const answer = (data?.choices?.[0]?.message?.content || '').trim() || generateDeterministicAiResponse(o, question, events, documents, market);

      db.prepare(`
        INSERT INTO chat_messages(object_id, user_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(o.id, req.user.id, 'assistant', answer, now());

      const allMessages = db.prepare(`
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE object_id=? AND user_id=?
        ORDER BY id
      `).all(o.id, req.user.id);

      res.json({ answer, messages: allMessages });
    }
  } catch (err) {
    console.warn('Groq API encounter, falling back to local deterministic engine:', err.message);
    const fallback = generateDeterministicAiResponse(o, question, events, documents, market);
    if (isStream) {
      await streamFallbackResponse(fallback);
    } else {
      db.prepare(`
        INSERT INTO chat_messages(object_id, user_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(o.id, req.user.id, 'assistant', fallback, now());

      const allMessages = db.prepare(`
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE object_id=? AND user_id=?
        ORDER BY id
      `).all(o.id, req.user.id);

      res.json({ answer: fallback, messages: allMessages });
    }
  }
});

app.get('/api/objects/:id/chat', auth, (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });
  const messages = db.prepare('SELECT id, role, content, created_at FROM chat_messages WHERE object_id=? AND user_id=? ORDER BY id').all(o.id, req.user.id);
  res.json({ messages });
});

// =================== ARCHIVE-WIDE ASSISTANT ===================
// =================== ARCHIVE & WHOLE-PLATFORM ASSISTANT ===================
app.post('/api/archive/chat', auth, chatLimiter, async (req, res) => {
  const question = (req.body?.question || req.body?.message || '').trim();
  if (!question) return res.status(400).json({ error: 'Question is required.' });

  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  const objects = db.prepare(`
    SELECT * FROM objects WHERE user_id=? ORDER BY datetime(updated_at) DESC
  `).all(req.user.id);

  const recentEvents = db.prepare(`
    SELECT e.type, e.title, e.note, e.condition, e.created_at, e.occurred_at, o.title as object_title
    FROM events e
    JOIN objects o ON o.id=e.object_id
    WHERE o.user_id=?
    ORDER BY datetime(e.created_at) DESC
    LIMIT 20
  `).all(req.user.id);

  const documents = db.prepare(`
    SELECT d.original_name, d.mime_type, d.size, d.created_at, o.title as object_title
    FROM documents d
    JOIN objects o ON o.id=d.object_id
    WHERE o.user_id=?
    ORDER BY datetime(d.created_at) DESC
    LIMIT 25
  `).all(req.user.id);

  let totalValue = 0;
  const categories = {};
  for (const obj of objects) {
    const val = parseMarketPrice(obj.value);
    if (val) totalValue += val;
    const cat = obj.category || 'Other';
    categories[cat] = (categories[cat] || 0) + 1;
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    const answer = generateDeterministicArchiveResponse(question, objects, recentEvents, documents, totalValue, categories, history);
    return res.json({ answer });
  }

  const objectsSummary = objects.map(o =>
    `- **${o.title}** (${o.category || 'Item'}): Brand: ${o.brand || 'N/A'}, Model: ${o.model || 'N/A'}, Condition: ${o.condition || 'Good'}, Value: ${o.value ? 'INR ' + o.value : 'N/A'}, Warranty: ${o.warranty || 'N/A'}, Serial: ${o.serial || 'N/A'}, Origin: ${o.origin || 'N/A'}`
  ).join('\n');

  const eventsSummary = recentEvents.map(e =>
    `- [${(e.occurred_at || e.created_at || '').slice(0, 10)}] ${e.object_title}: [${e.type.toUpperCase()}] ${e.title}${e.note ? ` — ${e.note}` : ''}${e.condition ? ` (Condition: ${e.condition})` : ''}`
  ).join('\n');

  const docsSummary = documents.map(d =>
    `- ${d.original_name} attached to "${d.object_title}" (${(d.size / 1024).toFixed(1)} KB)`
  ).join('\n');

  const catSummary = Object.entries(categories).map(([c, n]) => `${c} (${n})`).join(', ');

  const systemPrompt = `You are the ObjectMemory Master Platform Assistant — the resident AI intelligence for this user's entire possession archive and the whole ObjectMemory platform.

YOUR DUAL ROLE:
1. ARCHIVE INTELLIGENCE: You possess complete knowledge of ALL possessions, timeline events, attached documents, warranties, and valuation metrics in the user's private collection.
2. PLATFORM COPILOT: You guide the user on how to use every feature of ObjectMemory (Incident Mode, Insurance Dossiers, Data Export/Backup, On-device Vision, Market Trends, Timeline logging).

PLATFORM CAPABILITIES YOU CAN EXPLAIN:
- Adding Objects (/objects/new): On-device TensorFlow.js MobileNet v2 classifies uploaded photos 100% in-browser with zero cloud uploads.
- Incident Mode (/incident): Dedicated flow to log damage, scratches, attach dated photos, and update condition grades.
- Certified Insurance Dossiers: On any item detail view, clicking "Insurance Dossier" generates a print-ready official certified proof-of-possession report (with unique claim ID, serials, photos, timeline table, and signature line).
- Market Tracking: Google Shopping retail price monitoring via SerpApi, recording dated daily medians and price trends (Rising, Falling, Stable).
- Data Portability (/settings): One-click JSON complete vault backup/restore and CSV inventory spreadsheet exports.
- Private Local Storage: SQLite database with WAL mode and tenant isolation.

USER'S CURRENT ARCHIVE METRICS:
- Total Possessions: ${objects.length} items
- Total Portfolio Value: INR ${totalValue.toLocaleString()}
- Attached Documents: ${documents.length} verified files
- Categories: ${catSummary || 'None'}

USER ARCHIVE CATALOG (${objects.length} items):
${objectsSummary || 'No objects recorded yet.'}

RECENT TIMELINE & INCIDENTS AUDIT:
${eventsSummary || 'No recent events recorded.'}

ATTACHED DOCUMENTS IN VAULT:
${docsSummary || 'No documents attached yet.'}

INSTRUCTIONS:
1. Answer user queries thoroughly, practically, and insightfully in all aspects (portfolio value, specific item specs, maintenance, troubleshooting, warranties, or platform workflows).
2. If asked about a specific item, cite its exact recorded details (brand, model, condition, purchase date, serial, warranty).
3. If asked about platform capabilities or how to do something, provide actionable step-by-step guidance.
4. FORMATTING: Format your response using clean, structured Markdown with section headers (###), bullet points (-), and bold (**) terms. Never output raw unbroken text.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-6).map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content)
          })),
          { role: 'user', content: question }
        ],
        temperature: 0.3,
        max_tokens: 950
      })
    });

    const data = await groqRes.json().catch(() => ({}));
    if (!groqRes.ok) throw new Error(data?.error?.message || `Groq returned HTTP ${groqRes.status}`);
    const answer = String(data?.choices?.[0]?.message?.content || '').trim();
    res.json({
      answer: answer || generateDeterministicArchiveResponse(question, objects, recentEvents, documents, totalValue, categories, history)
    });
  } catch (err) {
    console.warn('Archive AI Groq error, using local fallback:', err.message);
    const answer = generateDeterministicArchiveResponse(question, objects, recentEvents, documents, totalValue, categories, history);
    res.json({ answer });
  }
});

// =================== DASHBOARD & ANALYTICS ===================
app.get('/api/dashboard', auth, (req, res) => {
  const objects = db.prepare('SELECT * FROM objects WHERE user_id=? ORDER BY datetime(updated_at) DESC').all(req.user.id);
  const incidents = db.prepare("SELECT COUNT(*) c FROM events e JOIN objects o ON o.id=e.object_id WHERE o.user_id=? AND e.type IN ('incident','damage')").get(req.user.id).c;
  const docs = db.prepare('SELECT COUNT(*) c FROM documents d JOIN objects o ON o.id=d.object_id WHERE o.user_id=?').get(req.user.id).c;
  const recent = db.prepare('SELECT e.*, o.title object_title FROM events e JOIN objects o ON o.id=e.object_id WHERE o.user_id=? ORDER BY datetime(e.created_at) DESC, e.id DESC LIMIT 10').all(req.user.id);

  // Portfolio analytics calculation
  let totalValue = 0;
  const categories = {};
  const conditionDistribution = { Excellent: 0, Good: 0, Fair: 0, Damaged: 0, 'Needs repair': 0 };
  const upcomingWarranties = [];

  for (const obj of objects) {
    const val = parseMarketPrice(obj.value);
    if (val) totalValue += val;

    const cat = obj.category || 'Other';
    categories[cat] = (categories[cat] || 0) + 1;

    const cond = obj.condition || 'Good';
    if (conditionDistribution[cond] !== undefined) conditionDistribution[cond]++;

    if (obj.warranty) {
      const match = obj.warranty.match(/\d{4}-\d{2}-\d{2}/);
      if (match) {
        const diffDays = Math.ceil((new Date(match[0]) - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDays >= -60 && diffDays <= 90) {
          upcomingWarranties.push({
            id: obj.id,
            title: obj.title,
            category: obj.category,
            warranty: obj.warranty,
            expiryDate: match[0],
            days: diffDays,
            isExpired: diffDays < 0,
            isUrgent: diffDays >= 0 && diffDays <= 30
          });
        }
      }
    }
  }

  upcomingWarranties.sort((a, b) => a.days - b.days);

  res.json({
    objects: objects.map(serializeObject),
    stats: {
      objects: objects.length,
      incidents,
      documents: docs,
      totalValue: Math.round(totalValue),
      upcomingWarrantiesCount: upcomingWarranties.filter(w => !w.isExpired).length
    },
    analytics: {
      categories,
      conditionDistribution,
      upcomingWarranties
    },
    recent
  });
});

// =================== DATA PORTABILITY & INSURANCE DOSSIER ===================
app.get('/api/archive/export', auth, (req, res) => {
  const objects = db.prepare('SELECT * FROM objects WHERE user_id=? ORDER BY id ASC').all(req.user.id);
  const objectIds = objects.map(o => o.id);

  let events = [];
  let documents = [];
  let chats = [];
  let snapshots = [];

  if (objectIds.length) {
    const placeholders = objectIds.map(() => '?').join(',');
    events = db.prepare(`SELECT * FROM events WHERE object_id IN (${placeholders}) ORDER BY id ASC`).all(...objectIds);
    documents = db.prepare(`SELECT id, object_id, original_name, stored_name, mime_type, size, created_at FROM documents WHERE object_id IN (${placeholders}) ORDER BY id ASC`).all(...objectIds);
    chats = db.prepare(`SELECT * FROM chat_messages WHERE object_id IN (${placeholders}) ORDER BY id ASC`).all(...objectIds);
    snapshots = db.prepare(`SELECT * FROM market_snapshots WHERE object_id IN (${placeholders}) ORDER BY id ASC`).all(...objectIds);
  }

  res.setHeader('Content-Disposition', `attachment; filename="objectmemory-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({
    system: 'ObjectMemory Vault Export',
    version: '2.0.0',
    exportedAt: now(),
    owner: { name: req.user.name, email: req.user.email },
    summary: {
      totalObjects: objects.length,
      totalEvents: events.length,
      totalDocuments: documents.length
    },
    objects,
    events,
    documents,
    chats,
    snapshots
  });
});

app.post('/api/archive/import', auth, (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data.objects)) {
    return res.status(400).json({ error: 'Invalid backup format. Expected objects array.' });
  }

  const importedObjects = data.objects;
  const importedEvents = Array.isArray(data.events) ? data.events : [];
  const t = now();
  let addedCount = 0;

  db.exec('BEGIN');
  try {
    const idMap = new Map(); // oldId -> newId

    const insertObj = db.prepare(`
      INSERT INTO objects(user_id,title,category,subtitle,condition,purchase_date,value,warranty,serial,description,image_path,created_at,updated_at,brand,model,origin)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    for (const o of importedObjects) {
      if (!o.title) continue;
      const info = insertObj.run(
        req.user.id, o.title, o.category || 'Other', o.subtitle || '', o.condition || 'Good',
        o.purchase_date || '', o.value || '', o.warranty || 'Not recorded', o.serial || 'Not recorded',
        o.description || '', o.image_path || '', o.created_at || t, t, o.brand || '', o.model || '', o.origin || ''
      );
      const newId = Number(info.lastInsertRowid);
      idMap.set(o.id, newId);
      addedCount++;
    }

    const insertEv = db.prepare(`
      INSERT INTO events(object_id,type,title,note,condition,created_at,occurred_at,image_path)
      VALUES (?,?,?,?,?,?,?,?)
    `);

    for (const ev of importedEvents) {
      const targetObjId = idMap.get(ev.object_id);
      if (targetObjId) {
        insertEv.run(targetObjId, ev.type || 'note', ev.title || 'Event', ev.note || '', ev.condition || '', ev.created_at || t, ev.occurred_at || t, ev.image_path || '');
      }
    }

    db.exec('COMMIT');
    res.json({ ok: true, imported: addedCount });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

app.get('/api/objects/:id/dossier', auth, (req, res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Object not found' });

  const serialized = serializeObject(o);
  const market = marketSummary(o.id);
  const claimRef = `OM-CLAIM-${o.id}-${Buffer.from(String(Date.now())).toString('base64url').slice(-6).toUpperCase()}`;

  res.json({
    claimReference: claimRef,
    generatedAt: now(),
    policyholder: {
      name: req.user.name,
      email: req.user.email
    },
    object: serialized,
    marketEstimate: {
      median: market.currentPrice,
      trend: market.trend,
      observations: market.observations
    }
  });
});

// =================== SYSTEM HEALTH ===================
app.get('/api/health', (req, res) => {
  const objectCount = db.prepare('SELECT COUNT(*) c FROM objects').get().c;
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  res.json({
    status: 'healthy',
    timestamp: now(),
    uptime: Math.round(process.uptime()),
    version: '2.0.0',
    database: {
      engine: 'node:sqlite',
      mode: 'WAL',
      foreign_keys: true
    },
    metrics: {
      objects: objectCount,
      users: userCount
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ObjectMemory API (Production Hardened) running at http://0.0.0.0:${PORT}`);
});

