import { neon, Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// HTTP-based sql tag for single-statement reads (fast, no connection overhead)
export const sql = neon(process.env.DATABASE_URL);

// Pool for transactions and writes
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper: run the schema migration
export async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id          TEXT        PRIMARY KEY,
        type        TEXT        NOT NULL CHECK (type IN ('dx', 'proc', 'ma')),
        region      TEXT        NOT NULL CHECK (region IN ('nose', 'ear', 'general')),
        title       TEXT        NOT NULL,
        description TEXT        NOT NULL DEFAULT '',
        blocks      JSONB       NOT NULL DEFAULT '[]'::jsonb,
        related     JSONB       NOT NULL DEFAULT '[]'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS media (
        filename     TEXT        PRIMARY KEY,
        url          TEXT        NOT NULL,
        kind         TEXT        NOT NULL CHECK (kind IN ('image', 'video', 'pdf', 'doc')),
        mime         TEXT        NOT NULL,
        size_bytes   INTEGER,
        uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS templates (
        id          TEXT        PRIMARY KEY,
        title       TEXT        NOT NULL,
        description TEXT        NOT NULL DEFAULT '',
        body        TEXT        NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}
