import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Pool } = pg;

await loadDotEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = join(__dirname, "..", "db", "schema.sql");
const sql = await readFile(schemaPath, "utf8");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
});

try {
  await pool.query(sql);
  console.log("Database schema applied.");
} finally {
  await pool.end();
}

async function loadDotEnv() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = await readFile(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
