import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import { sql, pool, ensureSchema } from './db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3100;
const MEDIA_DIR = path.join(__dirname, 'media');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH
  || crypto.createHash('sha256').update('ENT2024').digest('hex');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VALID_TYPES = new Set(['dx', 'proc', 'ma']);

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Map DB row to API response shape (column `description` → field `desc`,
// `created_at` → `createdAt`, etc.). Keeps existing API contract unchanged.
function rowToEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    region: row.region,
    title: row.title,
    desc: row.description,
    blocks: row.blocks || [],
    related: row.related || [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function rowToTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: 'template',
    title: row.title,
    desc: row.description,
    body: row.body,
  };
}

await ensureSchema();

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/media', express.static(MEDIA_DIR));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/api/entries', async (req, res) => {
  try {
    const rows = await sql`SELECT id, type, region, title, description FROM entries ORDER BY title`;
    res.json(rows.map(r => ({
      id: r.id,
      type: r.type,
      region: r.region,
      title: r.title,
      desc: r.description,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/entries/:id', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM entries WHERE id = ${req.params.id}`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rowToEntry(rows[0]));
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
    if (!VALID_TYPES.has(entry.type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const existing = await sql`SELECT id FROM entries WHERE id = ${entry.id}`;
    if (existing.length) return res.status(409).json({ error: 'Entry already exists' });

    const now = new Date().toISOString();
    const createdAt = entry.createdAt || now;
    const region = entry.region || 'general';
    const desc = entry.desc || '';
    const blocks = JSON.stringify(Array.isArray(entry.blocks) ? entry.blocks : []);
    const related = JSON.stringify(Array.isArray(entry.related) ? entry.related : []);

    const rows = await sql`
      INSERT INTO entries (id, type, region, title, description, blocks, related, created_at, updated_at)
      VALUES (${entry.id}, ${entry.type}, ${region}, ${entry.title}, ${desc},
              ${blocks}::jsonb, ${related}::jsonb, ${createdAt}, ${now})
      RETURNING *
    `;
    res.json(rowToEntry(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/entries/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const existingRows = await sql`SELECT * FROM entries WHERE id = ${id}`;
    if (!existingRows.length) return res.status(404).json({ error: 'Not found' });
    const existing = existingRows[0];

    const incoming = req.body || {};
    const type = incoming.type || existing.type;
    if (!VALID_TYPES.has(type)) return res.status(400).json({ error: 'Invalid type' });

    const region  = incoming.region !== undefined ? incoming.region : existing.region;
    const title   = incoming.title  !== undefined ? incoming.title  : existing.title;
    const desc    = incoming.desc   !== undefined ? incoming.desc   : existing.description;
    const blocks  = Array.isArray(incoming.blocks)  ? incoming.blocks  : existing.blocks;
    const related = Array.isArray(incoming.related) ? incoming.related : existing.related;
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE entries
      SET type        = ${type},
          region      = ${region},
          title       = ${title},
          description = ${desc},
          blocks      = ${JSON.stringify(blocks)}::jsonb,
          related     = ${JSON.stringify(related)}::jsonb,
          updated_at  = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
    res.json(rowToEntry(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/entries/:id', requireAuth, async (req, res) => {
  try {
    const rows = await sql`DELETE FROM entries WHERE id = ${req.params.id} RETURNING id`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/templates/:id', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM templates WHERE id = ${req.params.id}`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rowToTemplate(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Allowed upload types. Max is in MB. Anything not in this map is rejected.
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
  storage: multer.memoryStorage(),
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
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file' });

    const entry = MIME_TO_KIND[file.mimetype];
    if (!entry) return res.status(400).json({ error: 'Unsupported file type' });
    if (file.size > entry.max * 1024 * 1024) {
      return res.status(400).json({ error: `File too large. Max is ${entry.max}mb for this file type.` });
    }

    // Browsers give pasted screenshots generic filenames like "image.png"
    // or "blob" — replace those with a timestamped name so Cloudinary's
    // public_id (and the saved filename) is meaningful.
    const originalName = file.originalname;
    const isGenericName = (
      originalName === 'image.png' ||
      originalName === 'blob' ||
      originalName === 'image.jpeg' ||
      originalName === 'unknown'
    );
    const cloudinaryOpts = { folder: 'ent-reference', resource_type: 'auto' };
    if (isGenericName) {
      cloudinaryOpts.public_id = `screenshot-${Date.now()}`;
    }

    try {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          cloudinaryOpts,
          (uerr, result) => uerr ? reject(uerr) : resolve(result)
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
      });

      const ext = uploadResult.format
        || (file.originalname.match(/\.([^.]+)$/) || [, ''])[1];
      const baseName = uploadResult.public_id.split('/').pop();
      const filename = ext ? `${baseName}.${ext}` : baseName;
      const url = uploadResult.secure_url;

      await pool.query(
        `INSERT INTO media (filename, url, kind, mime, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (filename) DO UPDATE SET url = EXCLUDED.url`,
        [filename, url, entry.kind, file.mimetype, file.size]
      );

      const response = {
        filename,
        url,
        kind: entry.kind,
        mime: file.mimetype,
        sizeBytes: file.size,
      };
      if (entry.kind === 'doc') response.fileType = 'docx';
      res.json(response);
    } catch (uploadErr) {
      console.error('Upload error:', uploadErr);
      res.status(500).json({ error: 'Upload failed' });
    }
  });
});

app.delete('/api/media/:filename', requireAuth, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const rows = await sql`SELECT url FROM media WHERE filename = ${filename}`;
    if (rows.length) {
      // Best-effort Cloudinary delete: parse public_id from secure_url.
      const url = rows[0].url;
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (match) {
        const publicId = match[1];
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (cerr) {
          console.warn(`Cloudinary delete failed for ${publicId}: ${cerr.message}`);
        }
      }
      await sql`DELETE FROM media WHERE filename = ${filename}`;
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);

    const like = `%${q.toLowerCase()}%`;
    const rows = await sql`
      SELECT id, type, title, description, blocks
      FROM entries
      WHERE LOWER(title)       LIKE ${like}
         OR LOWER(description) LIKE ${like}
         OR LOWER(blocks::text) LIKE ${like}
    `;

    const lcQ = q.toLowerCase();
    const matches = rows.map(r => {
      let excerpt = '';
      const blocks = Array.isArray(r.blocks) ? r.blocks : [];
      for (const b of blocks) {
        const text = ((b.content || '') + ' ' + (b.note || '') + ' ' + (b.caption || '')).toLowerCase();
        if (text.includes(lcQ)) {
          excerpt = (b.content || b.caption || b.note || '').slice(0, 200);
          break;
        }
      }
      return {
        id: r.id,
        type: r.type,
        title: r.title,
        desc: r.description,
        excerpt: excerpt || (r.description || '').slice(0, 200),
      };
    });
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
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token });
});

app.use(express.static(__dirname, { index: false }));
app.get(/^\/(?!api\/|styles\/|scripts\/|media\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ENT Reference running at http://localhost:${PORT}`);
});
