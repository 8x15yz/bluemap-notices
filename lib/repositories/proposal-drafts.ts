import { getPool } from "@/lib/db";
import type { ProposalDraft, ProposalDraftMessage, ProposalDraftMessageRole } from "@/lib/types";

type ProposalDraftRow = {
  id: string;
  notice_id: string;
  analysis_report_id: string;
  content_markdown: string;
  model_provider: string;
  created_at: Date;
  updated_at: Date;
};

type ProposalDraftMessageRow = {
  id: string;
  draft_id: string;
  role: ProposalDraftMessageRole;
  content: string;
  created_at: Date;
};

export async function listProposalDraftsByNotice(noticeId: string): Promise<ProposalDraft[]> {
  const pool = getPool();
  const draftResult = await pool.query<ProposalDraftRow>(
    `
      SELECT *
      FROM proposal_drafts
      WHERE notice_id = $1
      ORDER BY updated_at DESC, id DESC
    `,
    [noticeId]
  );

  return attachMessages(draftResult.rows, await listMessagesForDraftRows(draftResult.rows));
}

export async function getProposalDraftById(noticeId: string, draftId: number): Promise<ProposalDraft | null> {
  const pool = getPool();
  const draftResult = await pool.query<ProposalDraftRow>(
    `
      SELECT *
      FROM proposal_drafts
      WHERE notice_id = $1
        AND id = $2
    `,
    [noticeId, draftId]
  );

  if (!draftResult.rows[0]) {
    return null;
  }

  const messages = await listMessagesForDraftRows(draftResult.rows);

  return attachMessages(draftResult.rows, messages)[0];
}

export async function getProposalDraftForAnalysisReport(
  noticeId: string,
  analysisReportId: number
): Promise<ProposalDraft | null> {
  const pool = getPool();
  const draftResult = await pool.query<ProposalDraftRow>(
    `
      SELECT *
      FROM proposal_drafts
      WHERE notice_id = $1
        AND analysis_report_id = $2
    `,
    [noticeId, analysisReportId]
  );

  if (!draftResult.rows[0]) {
    return null;
  }

  const messages = await listMessagesForDraftRows(draftResult.rows);

  return attachMessages(draftResult.rows, messages)[0];
}

export async function createProposalDraftWithMessage(params: {
  noticeId: string;
  analysisReportId: number;
  contentMarkdown: string;
  modelProvider: string;
  assistantMessage: string;
}): Promise<ProposalDraft> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const draftResult = await client.query<ProposalDraftRow>(
      `
        INSERT INTO proposal_drafts (
          notice_id, analysis_report_id, content_markdown, model_provider, updated_at
        )
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (notice_id, analysis_report_id) DO UPDATE SET
          content_markdown = EXCLUDED.content_markdown,
          model_provider = EXCLUDED.model_provider,
          updated_at = now()
        RETURNING *
      `,
      [params.noticeId, params.analysisReportId, params.contentMarkdown, params.modelProvider]
    );
    const draft = draftResult.rows[0];

    await client.query(
      `
        INSERT INTO proposal_draft_messages (draft_id, role, content)
        VALUES ($1, 'assistant', $2)
      `,
      [draft.id, params.assistantMessage]
    );

    const messageResult = await client.query<ProposalDraftMessageRow>(
      `
        SELECT *
        FROM proposal_draft_messages
        WHERE draft_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [draft.id]
    );

    await client.query("COMMIT");

    return attachMessages([draft], messageResult.rows)[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProposalDraftWithMessages(params: {
  draftId: number;
  contentMarkdown: string;
  modelProvider: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<ProposalDraft> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const draftResult = await client.query<ProposalDraftRow>(
      `
        UPDATE proposal_drafts
        SET content_markdown = $2,
            model_provider = $3,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [params.draftId, params.contentMarkdown, params.modelProvider]
    );

    if (!draftResult.rows[0]) {
      throw new Error("제안서 초안을 찾지 못했습니다.");
    }

    await client.query(
      `
        INSERT INTO proposal_draft_messages (draft_id, role, content)
        VALUES ($1, 'user', $2),
               ($1, 'assistant', $3)
      `,
      [params.draftId, params.userMessage, params.assistantMessage]
    );

    const messageResult = await client.query<ProposalDraftMessageRow>(
      `
        SELECT *
        FROM proposal_draft_messages
        WHERE draft_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [params.draftId]
    );

    await client.query("COMMIT");

    return attachMessages(draftResult.rows, messageResult.rows)[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listMessagesForDraftRows(draftRows: ProposalDraftRow[]): Promise<ProposalDraftMessageRow[]> {
  if (draftRows.length === 0) {
    return [];
  }

  const pool = getPool();
  const draftIds = draftRows.map((draft) => Number(draft.id));
  const result = await pool.query<ProposalDraftMessageRow>(
    `
      SELECT *
      FROM proposal_draft_messages
      WHERE draft_id = ANY($1::bigint[])
      ORDER BY draft_id ASC, created_at ASC, id ASC
    `,
    [draftIds]
  );

  return result.rows;
}

function attachMessages(draftRows: ProposalDraftRow[], messageRows: ProposalDraftMessageRow[]): ProposalDraft[] {
  const messagesByDraftId = new Map<number, ProposalDraftMessage[]>();

  for (const message of messageRows) {
    const draftId = Number(message.draft_id);
    const messages = messagesByDraftId.get(draftId) ?? [];
    messages.push(mapProposalDraftMessageRow(message));
    messagesByDraftId.set(draftId, messages);
  }

  return draftRows.map((draft) => ({
    ...mapProposalDraftRow(draft),
    messages: messagesByDraftId.get(Number(draft.id)) ?? []
  }));
}

function mapProposalDraftRow(row: ProposalDraftRow): Omit<ProposalDraft, "messages"> {
  return {
    id: Number(row.id),
    noticeId: row.notice_id,
    analysisReportId: Number(row.analysis_report_id),
    contentMarkdown: row.content_markdown,
    modelProvider: row.model_provider,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapProposalDraftMessageRow(row: ProposalDraftMessageRow): ProposalDraftMessage {
  return {
    id: Number(row.id),
    draftId: Number(row.draft_id),
    role: row.role,
    content: row.content,
    createdAt: row.created_at.toISOString()
  };
}
