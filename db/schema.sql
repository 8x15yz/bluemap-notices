CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  organization TEXT,
  budget_amount BIGINT,
  category TEXT NOT NULL DEFAULT 'bid',
  summary TEXT,
  raw_keywords_text TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS notice_scores (
  notice_id TEXT PRIMARY KEY REFERENCES notices(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  matched_keywords TEXT[] NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slack_notifications (
  id BIGSERIAL PRIMARY KEY,
  notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slack_notifications_notice_success_idx
  ON slack_notifications (notice_id)
  WHERE status = 'sent';

CREATE TABLE IF NOT EXISTS slack_digest_threads (
  id BIGSERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, message_ts)
);

CREATE TABLE IF NOT EXISTS slack_digest_items (
  id BIGSERIAL PRIMARY KEY,
  digest_id BIGINT NOT NULL REFERENCES slack_digest_threads(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL CHECK (item_index > 0),
  notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (digest_id, item_index)
);

CREATE INDEX IF NOT EXISTS slack_digest_threads_lookup_idx
  ON slack_digest_threads (channel_id, message_ts);

CREATE TABLE IF NOT EXISTS slack_event_receipts (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_reports (
  id BIGSERIAL PRIMARY KEY,
  notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  document_markdown TEXT NOT NULL,
  strategy_memo TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposal_drafts (
  id BIGSERIAL PRIMARY KEY,
  notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  analysis_report_id BIGINT NOT NULL REFERENCES analysis_reports(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notice_id, analysis_report_id)
);

CREATE INDEX IF NOT EXISTS proposal_drafts_notice_updated_idx
  ON proposal_drafts (notice_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS proposal_draft_messages (
  id BIGSERIAL PRIMARY KEY,
  draft_id BIGINT NOT NULL REFERENCES proposal_drafts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_draft_messages_draft_created_idx
  ON proposal_draft_messages (draft_id, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS notices_deadline_score_idx
  ON notices (deadline_at ASC, updated_at DESC);

CREATE TABLE IF NOT EXISTS filter_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('include_keyword', 'it_signal', 'non_it_exclude')),
  keyword TEXT NOT NULL,
  keyword_normalized TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS filter_rules_type_keyword_idx
  ON filter_rules (rule_type, keyword_normalized);

INSERT INTO filter_rules (rule_type, keyword, keyword_normalized)
SELECT 'include_keyword', keyword, lower(keyword)
FROM (
  VALUES
    ('해양'),
    ('해양수산'),
    ('항만'),
    ('선박'),
    ('운항'),
    ('항로'),
    ('전자해도'),
    ('해양정보'),
    ('해양데이터'),
    ('해양공간정보'),
    ('VTS'),
    ('프로세스'),
    ('해양안전'),
    ('스마트항만'),
    ('자율운항'),
    ('GIS'),
    ('공간정보'),
    ('지리정보시스템'),
    ('공간데이터'),
    ('데이터 표준화'),
    ('데이터 모델링'),
    ('API'),
    ('정보시스템'),
    ('플랫폼'),
    ('시스템 구축'),
    ('시스템 고도화'),
    ('시각화'),
    ('모니터링'),
    ('관제'),
    ('디지털트윈'),
    ('클라우드'),
    ('빅데이터'),
    ('공공데이터'),
    ('국제표준'),
    ('S-100')
) AS defaults(keyword)
ON CONFLICT DO NOTHING;

INSERT INTO filter_rules (rule_type, keyword, keyword_normalized)
SELECT 'it_signal', keyword, lower(keyword)
FROM (
  VALUES
    ('GIS'),
    ('지리정보시스템'),
    ('공간정보'),
    ('공간데이터'),
    ('데이터'),
    ('DB'),
    ('API'),
    ('정보시스템'),
    ('전산'),
    ('소프트웨어'),
    ('SW'),
    ('서버'),
    ('네트워크'),
    ('클라우드'),
    ('빅데이터'),
    ('디지털'),
    ('플랫폼'),
    ('포털'),
    ('시스템 구축'),
    ('시스템 고도화'),
    ('가상화'),
    ('시각화'),
    ('모니터링'),
    ('관제'),
    ('디지털트윈'),
    ('S-100')
) AS defaults(keyword)
ON CONFLICT DO NOTHING;

INSERT INTO filter_rules (rule_type, keyword, keyword_normalized)
SELECT 'non_it_exclude', keyword, lower(keyword)
FROM (
  VALUES
    ('시설정비'),
    ('시설 정비'),
    ('시설공사'),
    ('정비공사'),
    ('복구공사'),
    ('보수공사'),
    ('개보수'),
    ('보강공사'),
    ('리모델링'),
    ('인테리어'),
    ('건축공사'),
    ('토목공사'),
    ('전기공사'),
    ('소방공사'),
    ('기계설비'),
    ('조경'),
    ('포장공사'),
    ('배수로'),
    ('호안'),
    ('준설'),
    ('철거'),
    ('폐기물'),
    ('청소'),
    ('용역근로'),
    ('급식'),
    ('식자재'),
    ('연료유'),
    ('유류'),
    ('소모품'),
    ('예비품'),
    ('부속'),
    ('부품'),
    ('기자재'),
    ('장비 구매'),
    ('물품 구매'),
    ('구매(단가)'),
    ('임차'),
    ('차량'),
    ('헬리콥터')
) AS defaults(keyword)
ON CONFLICT DO NOTHING;
