import {
  Bell,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Star,
  TimerReset
} from "lucide-react";
import type { ReactNode } from "react";
import { SyncSubmitButton } from "@/app/sync-submit-button";
import { getNoticeStatus, type NoticeStatus } from "@/lib/notice-status";
import { listNotices, type NoticeListParams } from "@/lib/repositories/notices";
import { getScoreToneClass } from "@/lib/score-tone";
import type { NoticeRecord } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils/dates";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    deadline?: string;
    sync?: string;
    error?: string;
  }>;
};

type HomeFilters = {
  query: string;
  deadline?: "urgent";
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const result = await loadHomeData(filters);

  if (!result.ok) {
    return <SetupState message={result.message} />;
  }

  const notices = result.notices;
  const statusCounts = getStatusCounts(notices);
  const hasFilters = hasActiveFilters(filters);

  return (
    <>
      {params.sync ? <div className="notice-alert">{params.sync}</div> : null}
      {params.error ? <div className="notice-alert error">{params.error}</div> : null}

      <section className="status-strip" aria-label="공고 현황">
        <Metric label="후보 공고" value={notices.length} />
        <Metric label="마감 임박" value={statusCounts.urgent} />
        <Metric label="Slack 완료" value={statusCounts.slackSent} />
        <Metric label="공고 분석" value={statusCounts.withMemo} />
      </section>

      <section className="workspace">
        <aside className="panel side-panel">
          <div className="sync-action">
            <SyncSubmitButton />
          </div>
          <a className="button secondary settings-entry" href="/settings/keywords">
            <Settings2 size={16} />
            키워드 설정
          </a>

          <FilterPanel filters={filters} />
        </aside>

        <section className="panel content-panel">
          <div className="content-header">
            <div>
              <h2>후보 공고 되나?</h2>
            </div>
            {hasFilters ? (
              <a className="button secondary compact-button" href="/">
                필터 해제
              </a>
            ) : null}
          </div>

          <div className="notice-column-header" aria-label="후보 공고 목록 컬럼">
            <span>적합도</span>
            <span>공고명</span>
            <span>마감일</span>
          </div>

          <div className="notice-list">
            {notices.length === 0 ? (
              <div className="empty">
                {hasFilters ? "조건에 맞는 공고가 없습니다. 필터를 줄여보세요." : "아직 후보 공고가 없습니다. 공고 조회를 눌러 나라장터 공고를 가져오세요."}
              </div>
            ) : (
              notices.map((notice) => <NoticeItem key={notice.id} notice={notice} />)
            )}
          </div>
        </section>
      </section>
    </>
  );
}

async function loadHomeData(filters: HomeFilters): Promise<
  | {
      ok: true;
      notices: NoticeRecord[];
    }
  | {
      ok: false;
      message: string;
    }
> {
  try {
    const params: NoticeListParams = {
      query: filters.query,
      deadline: filters.deadline
    };
    const notices = await listNotices(params);

    return {
      ok: true,
      notices
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "공고 목록을 불러오지 못했습니다."
    };
  }
}

function FilterPanel({ filters }: { filters: HomeFilters }) {
  return (
    <form className="filter-form" action="/" method="get" role="search">
      <label className="field-label" htmlFor="q">
        검색
      </label>
      <div className="search-control">
        <input
          id="q"
          className="search-input"
          name="q"
          defaultValue={filters.query}
          placeholder="공고명, 기관, 키워드"
        />
        <button className="icon-button" type="submit" aria-label="검색">
          <Search size={17} />
        </button>
      </div>

      <label className="field-label" htmlFor="deadline">
        마감
      </label>
      <select id="deadline" className="select-input" name="deadline" defaultValue={filters.deadline ?? ""}>
        <option value="">전체 마감</option>
        <option value="urgent">7일 내 마감</option>
      </select>

      <div className="filter-actions">
        <button className="button" type="submit">
          <SlidersHorizontal size={16} />
          필터 적용
        </button>
        <a className="button secondary" href="/">
          초기화
        </a>
      </div>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}</strong>
    </div>
  );
}

function NoticeItem({ notice }: { notice: NoticeRecord }) {
  const status = getNoticeStatus(notice);

  return (
    <a className="notice-item" href={`/notices/${encodeURIComponent(notice.id)}`}>
      <div className={`score-badge ${getScoreToneClass(notice.score)}`} aria-label={`적합도 ${notice.score}점`}>
        <strong>{notice.score}점</strong>
      </div>
      <div className="notice-main">
        <h3>{notice.title}</h3>
        <div className="notice-meta">
          <span>{notice.organization ?? "기관 미확인"}</span>
          <span>{formatDateLabel(notice.deadlineAt)}</span>
          <span>{notice.summary ?? "입찰공고"}</span>
        </div>
        <div className="status-row" aria-label="공고 상태">
          {status.isUrgent ? (
            <StatusChip tone="urgent">
              <Clock3 size={14} />
              마감 임박
            </StatusChip>
          ) : null}
          {status.isHighScore ? (
            <StatusChip tone="high">
              <Star size={14} />
              고득점
            </StatusChip>
          ) : null}
          <StatusChip tone={status.isSlackSent ? "sent" : "waiting"}>
            {status.isSlackSent ? <CheckCircle2 size={14} /> : <Bell size={14} />}
            {status.isSlackSent ? "Slack 발송 완료" : "Slack 발송 대기"}
          </StatusChip>
          <StatusChip tone={status.hasAnalysisReport ? "memo" : "muted"}>
            <FileText size={14} />
            {status.hasAnalysisReport ? "공고 분석 있음" : "공고 분석 없음"}
          </StatusChip>
        </div>
        <div className="keyword-row">
          {notice.matchedKeywords.slice(0, 8).map((keyword) => (
            <span className="chip" key={keyword}>
              {keyword}
            </span>
          ))}
        </div>
      </div>
      <div className="notice-side">
        <span aria-label="마감일">
          <strong>{formatDeadlineDistance(status)}</strong>
        </span>
        <ExternalLink size={17} />
      </div>
    </a>
  );
}

function StatusChip({ children, tone }: { children: ReactNode; tone: "urgent" | "high" | "sent" | "waiting" | "memo" | "muted" }) {
  return <span className={`status-chip ${tone}`}>{children}</span>;
}

function SetupState({ message }: { message: string }) {
  return (
    <section className="panel detail-main">
      <h2>설정이 먼저 필요합니다</h2>
      <p className="notice-meta">{message}</p>
      <div className="detail-grid setup-grid">
        <div className="data-point">
          <span>1</span>
          <strong>
            <Database size={16} /> DATABASE_URL 설정
          </strong>
        </div>
        <div className="data-point">
          <span>2</span>
          <strong>
            <TimerReset size={16} /> npm run db:init
          </strong>
        </div>
        <div className="data-point">
          <span>3</span>
          <strong>
            <RefreshCw size={16} /> G2B_SERVICE_KEY 설정
          </strong>
        </div>
        <div className="data-point">
          <span>4</span>
          <strong>
            <Bell size={16} /> Slack 설정 선택
          </strong>
        </div>
      </div>
    </section>
  );
}

function parseFilters(params: Awaited<PageProps["searchParams"]>): HomeFilters {
  return {
    query: params.q?.trim() ?? "",
    deadline: params.deadline === "urgent" ? "urgent" : undefined
  };
}

function hasActiveFilters(filters: HomeFilters): boolean {
  return Boolean(filters.query || filters.deadline);
}

function getStatusCounts(notices: NoticeRecord[]): { urgent: number; slackSent: number; withMemo: number } {
  return notices.reduce(
    (counts, notice) => {
      const status = getNoticeStatus(notice);

      if (status.isUrgent) {
        counts.urgent += 1;
      }

      if (status.isSlackSent) {
        counts.slackSent += 1;
      }

      if (status.hasAnalysisReport) {
        counts.withMemo += 1;
      }

      return counts;
    },
    { urgent: 0, slackSent: 0, withMemo: 0 }
  );
}

function formatDeadlineDistance(status: NoticeStatus): string {
  if (typeof status.daysUntilDeadline !== "number") {
    return "미확인";
  }

  if (status.daysUntilDeadline < 0) {
    return "마감 지남";
  }

  if (status.daysUntilDeadline === 0) {
    return "오늘";
  }

  return `D-${status.daysUntilDeadline}`;
}
