import { getPool } from "@/lib/db";
import { getNotice } from "@/lib/repositories/notices";
import type { NoticeRecord } from "@/lib/types";

export type SlackDigestItemInput = {
  itemIndex: number;
  noticeId: string;
};

export type SlackDigestThreadInput = {
  channelId: string;
  messageTs: string;
  message?: string;
  items: SlackDigestItemInput[];
};

export async function recordSlackDigestThread(input: SlackDigestThreadInput): Promise<number> {
  const pool = getPool();
  const digestResult = await pool.query<{ id: string }>(
    `
      INSERT INTO slack_digest_threads (channel_id, message_ts, message)
      VALUES ($1, $2, $3)
      ON CONFLICT (channel_id, message_ts) DO UPDATE SET
        message = EXCLUDED.message
      RETURNING id
    `,
    [input.channelId, input.messageTs, input.message ?? null]
  );
  const digestId = Number(digestResult.rows[0].id);

  await pool.query("DELETE FROM slack_digest_items WHERE digest_id = $1", [digestId]);

  for (const item of input.items) {
    await pool.query(
      `
        INSERT INTO slack_digest_items (digest_id, item_index, notice_id)
        VALUES ($1, $2, $3)
      `,
      [digestId, item.itemIndex, item.noticeId]
    );
  }

  return digestId;
}

export async function findSlackDigestNoticeByItem(params: {
  channelId: string;
  threadTs: string;
  itemIndex: number;
}): Promise<NoticeRecord | null> {
  const pool = getPool();
  const result = await pool.query<{ notice_id: string }>(
    `
      SELECT sdi.notice_id
      FROM slack_digest_threads sdt
      JOIN slack_digest_items sdi ON sdi.digest_id = sdt.id
      WHERE sdt.channel_id = $1
        AND sdt.message_ts = $2
        AND sdi.item_index = $3
      LIMIT 1
    `,
    [params.channelId, params.threadTs, params.itemIndex]
  );
  const noticeId = result.rows[0]?.notice_id;

  return noticeId ? getNotice(noticeId) : null;
}

export async function recordSlackEventReceipt(eventId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ event_id: string }>(
    `
      INSERT INTO slack_event_receipts (event_id)
      VALUES ($1)
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `,
    [eventId]
  );

  return (result.rowCount ?? 0) > 0;
}
