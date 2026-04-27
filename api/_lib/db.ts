/**
 * Postgres helpers — shared by every API route.
 *
 * Reads $DATABASE_URL (Neon via Vercel Marketplace). Uses a Pool so
 * Vercel Functions can re-use connections within a Fluid Compute
 * instance, avoiding per-request handshakes.
 */

import { Pool } from '@neondatabase/serverless';

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

type Row = Record<string, unknown>;

export async function query<T = Row>(
  text: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const result = await getPool().query(text, params as unknown[]);
  return result.rows as T[];
}

export async function queryOne<T = Row>(
  text: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (tx: {
    query: <R = Row>(text: string, params?: readonly unknown[]) => Promise<R[]>;
  }) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn({
      query: async <R = Row>(text: string, params: readonly unknown[] = []) => {
        const r = await client.query(text, params as unknown[]);
        return r.rows as R[];
      },
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}
