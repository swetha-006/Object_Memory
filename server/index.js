import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, 'objectmemory.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
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
