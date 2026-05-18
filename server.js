import express from 'express';
import multer from 'multer';
import fse from 'fs-extra';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3100;
const DATA_DIR = path.join(__dirname, 'data');
const MEDIA_DIR = path.join(__dirname, 'media');

const TYPE_DIRS = {
  dx: 'diagnoses',
  proc: 'procedures',
  ma: 'protocols',
};
const DIR_TO_TYPE = {
  diagnoses: 'dx',
  procedures: 'proc',
  protocols: 'ma',
};

const PASSWORD_HASH = crypto.createHash('sha256').update('ENT2024').digest('hex');
const validTokens = new Set();

function issueToken() {
  const t = Buffer.from(`${PASSWORD_HASH}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`).toString('base64');
  validTokens.add(t);
  return t;
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !validTokens.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

await fse.ensureDir(MEDIA_DIR);
for (const dir of Object.values(TYPE_DIRS)) await fse.ensureDir(path.join(DATA_DIR, dir));

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/media', express.static(MEDIA_DIR));

async function findEntryFile(id) {
  for (const [type, dir] of Object.entries(TYPE_DIRS)) {
    const file = path.join(DATA_DIR, dir, `${id}.json`);
    if (await fse.pathExists(file)) return { file, type, dir };
  }
  return null;
}

async function readAllEntries() {
  const out = [];
  for (const [dirName, type] of Object.entries(DIR_TO_TYPE)) {
    const dir = path.join(DATA_DIR, dirName);
    const files = await fse.readdir(dir).catch(() => []);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const data = await fse.readJson(path.join(dir, f)).catch(() => null);
      if (data) {
        if (!data.type) data.type = type;
        out.push(data);
      }
    }
  }
  return out;
}

app.get('/api/entries', async (req, res) => {
  try {
    const all = await readAllEntries();
    res.json(all.map(({ id, type, region, title, desc }) => ({ id, type, region, title, desc })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/entries/:id', async (req, res) => {
  try {
    const found = await findEntryFile(req.params.id);
    if (!found) return res.status(404).json({ error: 'Not found' });
    const data = await fse.readJson(found.file);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/entries', requireAuth, async (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.id || !entry.type || !entry.title) {
      return res.status(400).json({ error: 'id, type, and title are required' });
    }
    const dir = TYPE_DIRS[entry.type];
    if (!dir) return res.status(400).json({ error: 'Invalid type' });
    const file = path.join(DATA_DIR, dir, `${entry.id}.json`);
    if (await fse.pathExists(file)) return res.status(409).json({ error: 'Entry already exists' });
    const now = new Date().toISOString();
    const full = {
      id: entry.id,
      type: entry.type,
      region: entry.region || 'general',
      title: entry.title,
      desc: entry.desc || '',
      blocks: Array.isArray(entry.blocks) ? entry.blocks : [],
      related: Array.isArray(entry.related) ? entry.related : [],
      createdAt: entry.createdAt || now,
      updatedAt: now,
    };
    await fse.writeJson(file, full, { spaces: 2 });
    res.json(full);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/entries/:id', requireAuth, async (req, res) => {
  try {
    const found = await findEntryFile(req.params.id);
    if (!found) return res.status(404).json({ error: 'Not found' });
    const existing = await fse.readJson(found.file);
    const incoming = req.body || {};
    const merged = {
      ...existing,
      ...incoming,
      id: existing.id,
      type: incoming.type || existing.type,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
    };
    if (merged.type !== existing.type) {
      const newDir = TYPE_DIRS[merged.type];
      if (!newDir) return res.status(400).json({ error: 'Invalid type' });
      const newFile = path.join(DATA_DIR, newDir, `${merged.id}.json`);
      await fse.writeJson(newFile, merged, { spaces: 2 });
      if (newFile !== found.file) await fse.remove(found.file);
    } else {
      await fse.writeJson(found.file, merged, { spaces: 2 });
    }
    res.json(merged);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/entries/:id', requireAuth, async (req, res) => {
  try {
    const found = await findEntryFile(req.params.id);
    if (!found) return res.status(404).json({ error: 'Not found' });
    await fse.remove(found.file);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Allowed upload types. Max is in MB. Anything not in this map is rejected.
// NOTE: orphaned-file cleanup is out of scope — files referenced by a deleted block
// remain on disk. Could be addressed later with a sweeper that diffs media/ against
// referenced URLs in data/**.
const MIME_TO_KIND = {
  'image/png':    { kind: 'image', max: 10  },
  'image/jpeg':   { kind: 'image', max: 10  },
  'image/gif':    { kind: 'image', max: 10  },
  'image/webp':   { kind: 'image', max: 10  },
  'application/pdf': { kind: 'pdf', max: 25 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { kind: 'doc', max: 25 },
  'video/mp4':       { kind: 'video', max: 100 },
  'video/quicktime': { kind: 'video', max: 100 },
  'video/webm':      { kind: 'video', max: 100 },
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!MIME_TO_KIND[file.mimetype]) {
      return cb(new Error('Unsupported file type'), false);
    }
    cb(null, true);
  },
});

app.post('/api/media/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const entry = MIME_TO_KIND[req.file.mimetype];
    if (!entry) {
      await fse.remove(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Unsupported file type' });
    }
    if (req.file.size > entry.max * 1024 * 1024) {
      await fse.remove(req.file.path).catch(() => {});
      return res.status(400).json({ error: `File too large. Max is ${entry.max}mb for this file type.` });
    }
    const response = {
      filename: req.file.filename,
      url: `/media/${req.file.filename}`,
      kind: entry.kind,
      mime: req.file.mimetype,
      sizeBytes: req.file.size,
    };
    if (entry.kind === 'doc') response.fileType = 'docx';
    res.json(response);
  });
});

app.delete('/api/media/:filename', requireAuth, async (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const file = path.join(MEDIA_DIR, safe);
    if (await fse.pathExists(file)) await fse.remove(file);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);
    const all = await readAllEntries();
    const matches = [];
    for (const e of all) {
      const inTitle = (e.title || '').toLowerCase().includes(q);
      const inDesc = (e.desc || '').toLowerCase().includes(q);
      let excerpt = '';
      const blocks = Array.isArray(e.blocks) ? e.blocks : [];
      for (const b of blocks) {
        const text = (b.content || '') + ' ' + (b.note || '') + ' ' + (b.caption || '');
        if (text.toLowerCase().includes(q)) {
          excerpt = (b.content || b.caption || b.note || '').slice(0, 200);
          break;
        }
      }
      if (inTitle || inDesc || excerpt) {
        matches.push({
          id: e.id,
          type: e.type,
          title: e.title,
          desc: e.desc,
          excerpt: excerpt || (e.desc || '').slice(0, 200),
        });
      }
    }
    res.json(matches);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string') return res.status(400).json({ error: 'Password required' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== PASSWORD_HASH) return res.status(401).json({ error: 'Incorrect password' });
  const token = issueToken();
  res.json({ token });
});

app.use(express.static(__dirname, { index: false }));
app.get(/^\/(?!api\/|styles\/|scripts\/|media\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ENT Reference running at http://localhost:${PORT}`);
});
