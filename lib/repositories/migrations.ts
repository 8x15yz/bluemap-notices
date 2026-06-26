import { getPool } from "@/lib/db";

type GlobalWithMigrationFlag = typeof globalThis & {
  bluemapRescoreColumnsEnsured?: boolean;
};

// notice_scores.is_active_candidate/scoring_version/rescored_at/inactive_reason are also
// defined in db/schema.sql for fresh installs, but production is migrated by the running
// app itself (no SSH/DB access available) the first time either listNotices() or the
// rescore endpoint runs. Cached on globalThis, mirroring lib/db.ts's pool caching, so it
// only runs once per process instead of on every request.
export async function ensureNoticeScoreRescoreColumns(): Promise<void> {
  const globalFlag = globalThis as GlobalWithMigrationFlag;

  if (globalFlag.bluemapRescoreColumnsEnsured) {
    return;
  }

  const pool = getPool();
  await pool.query(`
    ALTER TABLE notice_scores ADD COLUMN IF NOT EXISTS is_active_candidate BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notice_scores ADD COLUMN IF NOT EXISTS scoring_version TEXT;
    ALTER TABLE notice_scores ADD COLUMN IF NOT EXISTS rescored_at TIMESTAMPTZ;
    ALTER TABLE notice_scores ADD COLUMN IF NOT EXISTS inactive_reason TEXT;
  `);

  globalFlag.bluemapRescoreColumnsEnsured = true;
}
