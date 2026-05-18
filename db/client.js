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
  const { readFile } = await import('fs/promises');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schema = await readFile(join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(schema);
  } finally {
    client.release();
  }
}
