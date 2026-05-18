import dotenv from 'dotenv';
dotenv.config();

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool, ensureSchema } from '../db/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TYPE_DIRS = {
  dx:   join(ROOT, 'data/diagnoses'),
  proc: join(ROOT, 'data/procedures'),
  ma:   join(ROOT, 'data/protocols'),
};

async function migrate() {
  console.log('Starting migration to Neon...\n');

  // Create tables
  await ensureSchema();
  console.log('Schema created/verified.\n');

  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Migrate entries
    for (const [type, dir] of Object.entries(TYPE_DIRS)) {
      let files;
      try {
        files = (await readdir(dir)).filter(f => f.endsWith('.json'));
      } catch {
        console.warn(`Directory not found: ${dir} — skipping`);
        continue;
      }

      console.log(`Processing ${files.length} files from ${dir}`);

      for (const file of files) {
        try {
          const raw = await readFile(join(dir, file), 'utf8');
          const entry = JSON.parse(raw);

          const result = await client.query(`
            INSERT INTO entries
              (id, type, region, title, description, blocks, related, created_at, updated_at)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
              type        = EXCLUDED.type,
              region      = EXCLUDED.region,
              title       = EXCLUDED.title,
              description = EXCLUDED.description,
              blocks      = EXCLUDED.blocks,
              related     = EXCLUDED.related,
              updated_at  = EXCLUDED.updated_at
            RETURNING (xmax = 0) AS inserted
          `, [
            entry.id,
            entry.type,
            entry.region || 'general',
            entry.title,
            entry.desc || entry.description || '',
            JSON.stringify(entry.blocks || []),
            JSON.stringify(entry.related || []),
            entry.createdAt || new Date().toISOString(),
            entry.updatedAt || new Date().toISOString(),
          ]);

          if (result.rows[0].inserted) {
            inserted++;
          } else {
            updated++;
          }
        } catch (err) {
          console.error(`ERROR processing ${file}: ${err.message}`);
          errors++;
        }
      }
    }

    // Migrate templates
    const templatesDir = join(ROOT, 'data/templates');
    let templateFiles = [];
    try {
      templateFiles = (await readdir(templatesDir)).filter(f => f.endsWith('.json'));
    } catch {
      console.warn('No data/templates directory found — skipping templates.');
    }

    for (const file of templateFiles) {
      try {
        const raw = await readFile(join(templatesDir, file), 'utf8');
        const tmpl = JSON.parse(raw);

        await client.query(`
          INSERT INTO templates (id, title, description, body, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (id) DO UPDATE SET
            title       = EXCLUDED.title,
            description = EXCLUDED.description,
            body        = EXCLUDED.body,
            updated_at  = NOW()
        `, [
          tmpl.id,
          tmpl.title,
          tmpl.desc || tmpl.description || '',
          tmpl.body || '',
        ]);

        console.log(`Template migrated: ${tmpl.id}`);
      } catch (err) {
        console.error(`ERROR processing template ${file}: ${err.message}`);
        errors++;
      }
    }

    // Final counts
    const entryCount = await client.query('SELECT COUNT(*) FROM entries');
    const templateCount = await client.query('SELECT COUNT(*) FROM templates');

    console.log('\n── Migration complete ──');
    console.log(`Entries inserted: ${inserted}`);
    console.log(`Entries updated:  ${updated}`);
    console.log(`Errors:           ${errors}`);
    console.log(`Total in DB:      ${entryCount.rows[0].count} entries, ${templateCount.rows[0].count} templates`);

    if (errors > 0) {
      console.error('\nMigration completed with errors. Review above.');
      process.exit(1);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
