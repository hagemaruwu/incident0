import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/incidentzero',
  max: 10, // Maximum number of active connections in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if a connection cannot be established
};

// Global singleton pattern to prevent Next.js hot-reloads from exhausting connections in dev
declare global {
  var _pgPool: Pool | undefined;
}

export const pool = globalThis._pgPool || new Pool(poolConfig);

if (process.env.NODE_ENV !== 'production') {
  globalThis._pgPool = pool;
}

pool.on('error', (err) => {
  console.error('[pg.Pool] Unexpected error on idle client (evicted from pool):', err.message);
});

/**
 * Helper to run parameterized SQL queries with automatic client acquisition and release
 */
export async function query<T = any>(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  return {
    rows: res.rows as T[],
    rowCount: res.rowCount,
    duration,
  };
}