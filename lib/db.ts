import pg from "pg";

const { Pool } = pg;

type GlobalWithPool = typeof globalThis & {
  bluemapPool?: pg.Pool;
};

export function getPool(): pg.Pool {
  const globalForPool = globalThis as GlobalWithPool;

  if (globalForPool.bluemapPool) {
    return globalForPool.bluemapPool;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  globalForPool.bluemapPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
  });

  return globalForPool.bluemapPool;
}
