import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import multer from 'multer';
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
function ensureColumn(table,column,definition){
  const cols=db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name);
  if(!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('objects','brand',"TEXT DEFAULT ''");
ensureColumn('objects','model',"TEXT DEFAULT ''");
ensureColumn('objects','origin',"TEXT DEFAULT ''");
ensureColumn('events','image_path',"TEXT DEFAULT ''");
ensureColumn('events','occurred_at',"TEXT DEFAULT ''");

const now = () => new Date().toISOString();
const demoEmail = 'demo@objectmemory.local';
let demo = db.prepare('SELECT id FROM users WHERE email=?').get(demoEmail);
if (!demo) {
  const info = db.prepare('INSERT INTO users(name,email,password_hash,created_at) VALUES (?,?,?,?)')
    .run('Demo User', demoEmail, bcrypt.hashSync('demo123', 10), now());
  demo = { id: info.lastInsertRowid };
}
// No demo object is created automatically. Existing installs created by older builds may contain the old seeded car; remove only that exact seed once.
const legacySeed=db.prepare("SELECT id FROM objects WHERE user_id=? AND title='Automobile (sedan)' AND category='Car' AND image_path='' LIMIT 1").get(demo.id);
if(legacySeed){ db.prepare('DELETE FROM objects WHERE id=?').run(legacySeed.id); }


const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));
const JWT_SECRET = process.env.OBJECTMEMORY_JWT_SECRET || 'objectmemory-local-secret-change-me';

function marketQueryForObject(obj) {
  const identity = [obj.brand, obj.model, obj.title, obj.subtitle]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return identity;
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
  const sorted = [...values].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
}

function marketSummary(objectId) {
  const rows = db.prepare(`
    SELECT * FROM market_snapshots
    WHERE object_id=?
    ORDER BY datetime(observed_at) ASC, id ASC
  `).all(objectId);

  const byDay = new Map();
  for (const row of rows) {
    const day = row.observed_at.slice(0,10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(row);
  }

  const history = [...byDay.entries()].map(([date, items]) => ({
    date,
    price: Math.round(median(items.map(x=>Number(x.price))))
  }));

  const latest = history.length ? Number(history[history.length-1].price) : null;
  const previousDay = history.length > 1 ? history[history.length-2].price : null;
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
    lastObservedAt: rows[rows.length-1]?.observed_at || null,
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
  const normalizedQuery = query.toLowerCase();
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

  // Keep one listing per source/title pair and cap the snapshot size.
  const seen = new Set();
  return candidates.filter(r => {
    const key = `${r.source}|${r.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

app.get('/api/objects/:id/market', auth, async (req,res) => {
  const o = objectForUser(req.params.id, req.user.id);
  if (!o) return res.status(404).json({error:'Object not found'});

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
        for (const item of listings) insert.run(o.id,t,item.price,'INR',item.source,item.title,item.url);
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

function auth(req,res,next){
  const token = (req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Authentication required'});
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { return res.status(401).json({error:'Invalid or expired session'}); }
}
function publicUser(row){ return {id:row.id,name:row.name,email:row.email}; }
function objectForUser(id,userId){ return db.prepare('SELECT * FROM objects WHERE id=? AND user_id=?').get(id,userId); }
function serializeObject(o){
  if(!o) return null;
  return {
    ...o,
    imageUrl: o.image_path ? '/uploads/'+o.image_path : null,
    events: db.prepare("SELECT *, CASE WHEN image_path IS NOT NULL AND image_path != '' THEN '/uploads/'||image_path ELSE NULL END AS imageUrl FROM events WHERE object_id=? ORDER BY datetime(CASE WHEN occurred_at IS NOT NULL AND occurred_at != '' THEN occurred_at ELSE created_at END) DESC,id DESC").all(o.id),
    documents: db.prepare('SELECT id,original_name,mime_type,size,created_at,stored_name FROM documents WHERE object_id=? ORDER BY datetime(created_at) DESC,id DESC').all(o.id),
  };
}
function aiReply(obj, question){
  const q = question.toLowerCase();
  const events = db.prepare('SELECT * FROM events WHERE object_id=? ORDER BY datetime(created_at) DESC').all(obj.id);
  if(q.includes('condition') || q.includes('damage') || q.includes('state')) return `The current recorded condition for ${obj.title} is “${obj.condition}”. ${events.filter(e=>e.type==='damage'||e.type==='incident').slice(0,2).map(e=>e.note||e.title).join(' ') || 'There are no additional damage notes recorded yet.'}`;
  if(q.includes('purchase') || q.includes('bought')) return obj.purchase_date ? `${obj.title} was recorded as purchased on ${obj.purchase_date}.` : 'No purchase date has been recorded yet.';
  if(q.includes('warranty')) return `Warranty information: ${obj.warranty || 'Not recorded'}.`;
  if(q.includes('serial')) return `Serial number: ${obj.serial || 'Not recorded'}.`;
  if(q.includes('value') || q.includes('worth')) return `The recorded value is ${obj.value || 'not recorded'}. This is your stored value, not a live market valuation.`;
  if(q.includes('document')) return `${db.prepare('SELECT COUNT(*) c FROM documents WHERE object_id=?').get(obj.id).c} document(s) are stored for this object.`;
  if(q.includes('history') || q.includes('timeline')) return `I found ${events.length} memory event(s). The latest is ${events[0] ? events[0].title+' — '+events[0].note : 'not recorded yet'}.`;
  return `I’m your local ObjectMemory assistant. For ${obj.title}, I can answer about its condition, damage notes, purchase date, warranty, serial number, value, documents, and memory timeline using the data stored in this local database.`;
}

app.post('/api/auth/register',(req,res)=>{
  const {name,email,password}=req.body||{};
  if(!name||!email||!password||password.length<6) return res.status(400).json({error:'Name, email and a password of at least 6 characters are required.'});
  try{
    const info=db.prepare('INSERT INTO users(name,email,password_hash,created_at) VALUES (?,?,?,?)').run(name.trim(),email.trim().toLowerCase(),bcrypt.hashSync(password,10),now());
    const user={id:Number(info.lastInsertRowid),name:name.trim(),email:email.trim().toLowerCase()};
    const token=jwt.sign(user,JWT_SECRET,{expiresIn:'7d'}); res.json({token,user});
  }catch(e){res.status(409).json({error:'An account with that email already exists.'});}
});
app.post('/api/auth/login',(req,res)=>{
  const {email,password}=req.body||{}; const u=db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(email||'');
  if(!u || !bcrypt.compareSync(password||'',u.password_hash)) return res.status(401).json({error:'Email or password is incorrect.'});
  const user=publicUser(u); const token=jwt.sign(user,JWT_SECRET,{expiresIn:'7d'}); res.json({token,user});
});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));

app.get('/api/objects',auth,(req,res)=>{
  const q=(req.query.search||'').trim();
  const rows=q ? db.prepare("SELECT * FROM objects WHERE user_id=? AND (title LIKE ? OR category LIKE ? OR subtitle LIKE ?) ORDER BY datetime(updated_at) DESC").all(req.user.id,`%${q}%`,`%${q}%`,`%${q}%`) : db.prepare('SELECT * FROM objects WHERE user_id=? ORDER BY datetime(updated_at) DESC').all(req.user.id);
  res.json({objects:rows.map(serializeObject)});
});
app.post('/api/objects',auth,(req,res)=>{
  const b=req.body||{}; if(!b.title) return res.status(400).json({error:'Object name is required.'}); const t=now();
  const info=db.prepare(`INSERT INTO objects(user_id,title,category,subtitle,condition,purchase_date,value,warranty,serial,description,created_at,updated_at,brand,model,origin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id,b.title,b.category||'Other',b.subtitle||'',b.condition||'Good',b.purchaseDate||'',b.value||'',b.warranty||'Not recorded',b.serial||'Not recorded',b.description||'',t,t,b.brand||'',b.model||'',b.origin||'');
  const id=Number(info.lastInsertRowid); db.prepare('INSERT INTO events(object_id,type,title,note,condition,created_at) VALUES (?,?,?,?,?,?)').run(id,'created','Object added',`${b.title} entered your ObjectMemory.`,b.condition||'Good',t);
  res.status(201).json({object:serializeObject(objectForUser(id,req.user.id))});
});
app.get('/api/objects/:id',auth,(req,res)=>{const o=objectForUser(req.params.id,req.user.id); if(!o)return res.status(404).json({error:'Object not found'});res.json({object:serializeObject(o)});});
app.put('/api/objects/:id',auth,(req,res)=>{
  const o=objectForUser(req.params.id,req.user.id); if(!o)return res.status(404).json({error:'Object not found'}); const b=req.body||{}; const fields=['title','brand','model','category','origin','subtitle','condition','purchaseDate','value','warranty','serial','description']; const vals=fields.map(k=>b[k] ?? o[k==='purchaseDate'?'purchase_date':k]); const cols=['title','brand','model','category','origin','subtitle','condition','purchase_date','value','warranty','serial','description']; const t=now();
  db.prepare(`UPDATE objects SET ${cols.map(c=>c+'=?').join(',')},updated_at=? WHERE id=? AND user_id=?`).run(...vals,t,o.id,req.user.id);
  if(b.condition && b.condition!==o.condition) db.prepare('INSERT INTO events(object_id,type,title,note,condition,created_at) VALUES (?,?,?,?,?,?)').run(o.id,'condition','Condition updated',`Condition changed from ${o.condition} to ${b.condition}.`,b.condition,t);
  res.json({object:serializeObject(objectForUser(o.id,req.user.id))});
});
app.delete('/api/objects/:id',auth,(req,res)=>{const o=objectForUser(req.params.id,req.user.id);if(!o)return res.status(404).json({error:'Object not found'});db.prepare('DELETE FROM objects WHERE id=?').run(o.id);res.json({ok:true});});

app.post('/api/objects/:id/events',auth,(req,res)=>{
  const o=objectForUser(req.params.id,req.user.id);
  if(!o)return res.status(404).json({error:'Object not found'});
  const {type='note',title,note='',condition='',occurredAt=''}=req.body||{};
  if(!title)return res.status(400).json({error:'Event title is required.'});
  const t=now();
  const info=db.prepare('INSERT INTO events(object_id,type,title,note,condition,created_at,occurred_at,image_path) VALUES (?,?,?,?,?,?,?,?)').run(o.id,type,title,note,condition,t,occurredAt||t,'');
  db.prepare('UPDATE objects SET updated_at=? WHERE id=?').run(t,o.id);
  const event=db.prepare(`SELECT *, CASE WHEN image_path IS NOT NULL AND image_path != '' THEN '/uploads/'||image_path ELSE NULL END AS imageUrl FROM events WHERE id=?`).get(Number(info.lastInsertRowid));
  res.status(201).json({object:serializeObject(objectForUser(o.id,req.user.id)),event});
});

const storage=multer.diskStorage({destination:uploadDir,filename:(req,file,cb)=>{const ext=path.extname(file.originalname);cb(null,crypto.randomUUID()+ext)}});
const upload=multer({storage,limits:{fileSize:10*1024*1024}});
app.post('/api/objects/:id/documents',auth,upload.single('file'),(req,res)=>{const o=objectForUser(req.params.id,req.user.id);if(!o)return res.status(404).json({error:'Object not found'});if(!req.file)return res.status(400).json({error:'Choose a file.'});const t=now();db.prepare('INSERT INTO documents(object_id,original_name,stored_name,mime_type,size,created_at) VALUES (?,?,?,?,?,?)').run(o.id,req.file.originalname,req.file.filename,req.file.mimetype,req.file.size,t);db.prepare('INSERT INTO events(object_id,type,title,note,created_at) VALUES (?,?,?,?,?)').run(o.id,'document','Document added',req.file.originalname,t);res.status(201).json({object:serializeObject(objectForUser(o.id,req.user.id))});});
app.post('/api/objects/:id/image',auth,upload.single('file'),(req,res)=>{
  const o=objectForUser(req.params.id,req.user.id);
  if(!o)return res.status(404).json({error:'Object not found'});
  if(!req.file)return res.status(400).json({error:'Choose an image.'});
  if(!req.file.mimetype.startsWith('image/')){try{fs.unlinkSync(path.join(uploadDir,req.file.filename))}catch{};return res.status(400).json({error:'Only image files are allowed.'});}
  if(o.image_path){try{fs.unlinkSync(path.join(uploadDir,o.image_path))}catch{}}
  const t=now();
  db.prepare('UPDATE objects SET image_path=?,updated_at=? WHERE id=? AND user_id=?').run(req.file.filename,t,o.id,req.user.id);
  db.prepare('INSERT INTO events(object_id,type,title,note,created_at) VALUES (?,?,?,?,?)').run(o.id,'photo','Photo added','Object photo updated.',t);
  res.status(201).json({object:serializeObject(objectForUser(o.id,req.user.id))});
});
app.post('/api/objects/:id/events/:eventId/image',auth,upload.single('file'),(req,res)=>{
  const o=objectForUser(req.params.id,req.user.id);
  if(!o)return res.status(404).json({error:'Object not found'});
  const event=db.prepare('SELECT * FROM events WHERE id=? AND object_id=?').get(req.params.eventId,o.id);
  if(!event)return res.status(404).json({error:'Event not found'});
  if(!req.file)return res.status(400).json({error:'Choose an image.'});
  if(!req.file.mimetype.startsWith('image/')){try{fs.unlinkSync(path.join(uploadDir,req.file.filename))}catch{};return res.status(400).json({error:'Only image files are allowed.'});}
  if(event.image_path){try{fs.unlinkSync(path.join(uploadDir,event.image_path))}catch{}}
  db.prepare('UPDATE events SET image_path=? WHERE id=?').run(req.file.filename,event.id);
  const t=now();db.prepare('UPDATE objects SET updated_at=? WHERE id=?').run(t,o.id);
  const updated=db.prepare(`SELECT *, CASE WHEN image_path IS NOT NULL AND image_path != '' THEN '/uploads/'||image_path ELSE NULL END AS imageUrl FROM events WHERE id=?`).get(event.id);
  res.status(201).json({event:updated});
});

app.delete('/api/documents/:id',auth,(req,res)=>{const d=db.prepare('SELECT d.*,o.user_id FROM documents d JOIN objects o ON o.id=d.object_id WHERE d.id=? AND o.user_id=?').get(req.params.id,req.user.id);if(!d)return res.status(404).json({error:'Document not found'});try{fs.unlinkSync(path.join(uploadDir,d.stored_name))}catch{}db.prepare('DELETE FROM documents WHERE id=?').run(d.id);res.json({ok:true});});

app.post('/api/objects/:id/chat',auth,(req,res)=>{const o=objectForUser(req.params.id,req.user.id);if(!o)return res.status(404).json({error:'Object not found'});const question=(req.body?.message||'').trim();if(!question)return res.status(400).json({error:'Message is required.'});const t=now();db.prepare('INSERT INTO chat_messages(object_id,user_id,role,content,created_at) VALUES (?,?,?,?,?)').run(o.id,req.user.id,'user',question,t);const answer=aiReply(o,question);db.prepare('INSERT INTO chat_messages(object_id,user_id,role,content,created_at) VALUES (?,?,?,?,?)').run(o.id,req.user.id,'assistant',answer,now());res.json({answer,messages:db.prepare('SELECT id,role,content,created_at FROM chat_messages WHERE object_id=? AND user_id=? ORDER BY id').all(o.id,req.user.id)});});
app.get('/api/objects/:id/chat',auth,(req,res)=>{const o=objectForUser(req.params.id,req.user.id);if(!o)return res.status(404).json({error:'Object not found'});res.json({messages:db.prepare('SELECT id,role,content,created_at FROM chat_messages WHERE object_id=? AND user_id=? ORDER BY id').all(o.id,req.user.id)});});

app.get('/api/dashboard',auth,(req,res)=>{const objects=db.prepare('SELECT * FROM objects WHERE user_id=? ORDER BY datetime(updated_at) DESC').all(req.user.id);const incidents=db.prepare("SELECT COUNT(*) c FROM events e JOIN objects o ON o.id=e.object_id WHERE o.user_id=? AND e.type IN ('incident','damage')").get(req.user.id).c;const docs=db.prepare('SELECT COUNT(*) c FROM documents d JOIN objects o ON o.id=d.object_id WHERE o.user_id=?').get(req.user.id).c;const recent=db.prepare('SELECT e.*,o.title object_title FROM events e JOIN objects o ON o.id=e.object_id WHERE o.user_id=? ORDER BY datetime(e.created_at) DESC,e.id DESC LIMIT 10').all(req.user.id);res.json({objects:objects.map(serializeObject),stats:{objects:objects.length,incidents,documents:docs},recent});});

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:err.message||'Server error'});});
const PORT=process.env.PORT||5000;app.listen(PORT,()=>console.log(`ObjectMemory API running at http://localhost:${PORT}`));
