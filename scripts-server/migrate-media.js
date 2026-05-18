import dotenv from 'dotenv';
dotenv.config();

import { readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { pool } from '../db/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MEDIA_DIR = join(ROOT, 'media');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MIME_TO_KIND = {
  'image/png':   'image', 'image/jpeg': 'image',
  'image/gif':   'image', 'image/webp': 'image',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
  'video/mp4': 'video', 'video/quicktime': 'video', 'video/webm': 'video',
};

async function migrateMedia() {
  console.log('Starting media migration...\n');

  const client = await pool.connect();
  let uploaded = 0;
  let skipped = 0;
  let errors  = 0;

  try {
    // media/ directory
    let files = [];
    try {
      const all = await readdir(MEDIA_DIR);
      files = all.filter(f => f !== '.gitkeep');
    } catch {
      console.log('media/ directory empty or not found — nothing to migrate.');
    }

    for (const file of files) {
      const filePath = join(MEDIA_DIR, file);
      try {
        const fileStat = await stat(filePath);
        const result = await cloudinary.uploader.upload(filePath, {
          folder: 'ent-reference',
          resource_type: 'auto',
          public_id: file.replace(/\.[^.]+$/, ''), // filename without extension
          use_filename: true,
          unique_filename: false,
        });

        await client.query(`
          INSERT INTO media (filename, url, kind, mime, size_bytes, uploaded_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (filename) DO UPDATE SET url = EXCLUDED.url
        `, [
          file,
          result.secure_url,
          result.resource_type === 'video' ? 'video' : 'image',
          result.format,
          fileStat.size,
        ]);

        // Rewrite src references in entries.blocks
        await client.query(`
          UPDATE entries
          SET blocks = (
            SELECT jsonb_agg(
              CASE
                WHEN block->>'src' = $1 THEN jsonb_set(block, '{src}', to_jsonb($2::text))
                ELSE block
              END
            )
            FROM jsonb_array_elements(blocks) AS block
          )
          WHERE blocks::text LIKE $3
        `, [
          `/media/${file}`,
          result.secure_url,
          `%/media/${file}%`,
        ]);

        console.log(`Uploaded: ${file} → ${result.secure_url}`);
        uploaded++;
      } catch (err) {
        console.error(`ERROR uploading ${file}: ${err.message}`);
        errors++;
      }
    }

    console.log('\n── Media migration complete ──');
    console.log(`Uploaded: ${uploaded}, Skipped: ${skipped}, Errors: ${errors}`);

  } finally {
    client.release();
    await pool.end();
  }
}

migrateMedia().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
