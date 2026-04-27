/**
 * Run pending SQL migrations against $DATABASE_URL.
 *
 * Usage:
 *   tsx scripts/migrate.ts
 *
 * Each .sql file in /migrations is applied in lexicographic order, and
 * recorded in the schema_migrations table. Re-running is safe: applied
 * migrations are skipped. Each file runs inside a single transaction.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = resolve(ROOT, 'migrations');

// Load .env.local (or .env) before reading process.env. Node 20.6+ ships
// process.loadEnvFile so we don't need the dotenv package.
for (const name of ['.env.local', '.env']) {
  const path = resolve(ROOT, name);
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await pool.query<{ name: string }>(
      'SELECT name FROM schema_migrations'
    );
    const applied = new Set(rows.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip   ${file} (already applied)`);
        continue;
      }
      const body = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      const client = await pool.connect();
      try {
        console.log(`apply  ${file}`);
        await client.query('BEGIN');
        await client.query(body);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        ran += 1;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    }

    console.log(ran === 0 ? 'No pending migrations.' : `Applied ${ran} migration(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
