import { ArrowLeft, Database, Plus, Power, PowerOff, Settings2, Trash2 } from "lucide-react";
import {
  createFilterRuleAction,
  deleteFilterRuleAction,
  toggleFilterRuleAction
} from "@/app/settings/keywords/actions";
import {
  groupFilterRules,
  getFilterImpactSummary,
  listFilterRules,
  type FilterImpactSummary,
  type FilterRule,
  type FilterRuleGroups,
  type FilterRuleType
} from "@/lib/repositories/filter-rules";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

type RuleSectionConfig = {
  type: FilterRuleType;
  title: string;
  description: string;
  placeholder: string;
};

const ruleSections: RuleSectionConfig[] = [
  {
    type: "include_keyword",
    title: "후보 포함 키워드",
    description: "공고를 후보로 선별하는 기준입니다.",
    placeholder: "예: 해양 디지털트윈"
  },
  {
    type: "it_signal",
    title: "IT 관련 키워드",
    description: "공사·물품 공고라도 이 신호가 있으면 후보로 유지합니다.",
    placeholder: "예: 데이터 플랫폼"
  },
  {
    type: "non_it_exclude",
    title: "제외 키워드",
    description: "시설·구매성 공고를 후보에서 빼는 기준입니다.",
    placeholder: "예: 배관공사"
  }
];

export default async function KeywordSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await loadFilterRules();

  if (!result.ok) {
    return <SetupState message={result.message} />;
  }

  const groups = result.groups;
  const activeIncludeCount = groups.include_keyword.filter((rule) => rule.enabled).length;

  return (
    <>
      {params.saved ? <div className="notice-alert">{params.saved}</div> : null}
      {params.error ? <div className="notice-alert error">{params.error}</div> : null}
      {activeIncludeCount === 0 ? (
        <div className="notice-alert error">후보 포함 키워드가 모두 꺼져 있어 새 후보가 거의 저장되지 않을 수 있습니다.</div>
      ) : null}

      <section className="panel settings-page">
        <div className="settings-header">
          <div>
            <a className="back-link" href="/">
              <ArrowLeft size={16} />
              공고 목록
            </a>
            <h2>키워드 설정</h2>
            <p className="notice-meta">저장하면 기존 후보 신호와 다음 나라장터 조회에 함께 반영됩니다.</p>
          </div>
          <span className="settings-mark" aria-hidden="true">
            <Settings2 size={22} />
          </span>
        </div>

        <div className="settings-summary" aria-label="필터 규칙 요약">
          <RuleMetric label="포함 키워드" rules={groups.include_keyword} />
          <RuleMetric label="IT 관련 키워드" rules={groups.it_signal} />
          <RuleMetric label="제외 키워드" rules={groups.non_it_exclude} />
        </div>
        <FilterImpactPanel impact={result.impact} />

        <div className="rule-sections">
          {ruleSections.map((section) => (
            <RuleSection key={section.type} section={section} rules={groups[section.type]} />
          ))}
        </div>
      </section>
    </>
  );
}

async function loadFilterRules(): Promise<
  | {
      ok: true;
      groups: FilterRuleGroups;
      impact: FilterImpactSummary;
    }
  | {
      ok: false;
      message: string;
    }
> {
  try {
    const [rules, impact] = await Promise.all([listFilterRules(), getFilterImpactSummary()]);

    return {
      ok: true,
      groups: groupFilterRules(rules),
      impact
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "키워드 설정을 불러오지 못했습니다."
    };
  }
}

function RuleMetric({ label, rules }: { label: string; rules: FilterRule[] }) {
  const active = rules.filter((rule) => rule.enabled).length;

  return (
    <div className="rule-metric">
      <span>{label}</span>
      <strong>
        {active}
        <small> / {rules.length}</small>
      </strong>
    </div>
  );
}

function FilterImpactPanel({ impact }: { impact: FilterImpactSummary }) {
  return (
    <section className="filter-impact" aria-label="필터 적용 결과">
      <div className="impact-metrics">
        <ImpactMetric label="필터 전 후보" value={impact.beforeCount} />
        <ImpactMetric label="필터 후 후보" value={impact.afterCount} />
        <ImpactMetric label="최근 제외" value={impact.excludedCount} />
      </div>
      <div className="recent-excluded">
        <div className="recent-excluded-header">
          <strong>최근 제외 공고</strong>
          <span>{impact.recentExcluded.length}건 미리보기</span>
        </div>
        {impact.recentExcluded.length === 0 ? (
          <div className="empty compact">필터로 제외된 후보가 없습니다.</div>
        ) : (
          <div className="recent-excluded-list">
            {impact.recentExcluded.map((notice) => (
              <a className="recent-excluded-item" href={`/notices/${encodeURIComponent(notice.id)}`} key={notice.id}>
                <span>{notice.score}점</span>
                <strong>{notice.title}</strong>
                <small>{notice.organization ?? "기관 미확인"}</small>
                {notice.reason ? <small className="recent-excluded-reason">{notice.reason}</small> : null}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ImpactMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="impact-metric">
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}</strong>
    </div>
  );
}

function RuleSection({ section, rules }: { section: RuleSectionConfig; rules: FilterRule[] }) {
  const active = rules.filter((rule) => rule.enabled).length;

  return (
    <section className="rule-section" aria-labelledby={`${section.type}-title`}>
      <div className="rule-section-header">
        <div>
          <h3 id={`${section.type}-title`}>{section.title}</h3>
          <p>{section.description}</p>
        </div>
        <span className="rule-count">
          {active}/{rules.length} 사용
        </span>
      </div>

      <form className="keyword-add-form" action={createFilterRuleAction}>
        <input type="hidden" name="ruleType" value={section.type} />
        <input className="search-input" name="keyword" placeholder={section.placeholder} required />
        <button className="icon-button" type="submit" aria-label={`${section.title} 추가`} title="추가">
          <Plus size={18} />
        </button>
      </form>

      <div className="rule-list">
        {rules.length === 0 ? (
          <div className="empty compact">아직 등록된 키워드가 없습니다.</div>
        ) : (
          rules.map((rule) => <RuleRow key={rule.id} rule={rule} />)
        )}
      </div>
    </section>
  );
}

function RuleRow({ rule }: { rule: FilterRule }) {
  return (
    <div className={`rule-row${rule.enabled ? "" : " disabled"}`}>
      <div className="rule-row-main">
        <span className="rule-keyword">{rule.keyword}</span>
        <span className={`rule-state${rule.enabled ? "" : " muted"}`}>{rule.enabled ? "사용 중" : "중지"}</span>
      </div>
      <div className="rule-row-actions">
        <form action={toggleFilterRuleAction}>
          <input type="hidden" name="id" value={rule.id} />
          <input type="hidden" name="enabled" value={String(!rule.enabled)} />
          <button
            className="icon-button secondary compact-icon-button"
            type="submit"
            aria-label={rule.enabled ? `${rule.keyword} 일시중지` : `${rule.keyword} 다시 사용`}
            title={rule.enabled ? "일시중지" : "다시 사용"}
          >
            {rule.enabled ? <PowerOff size={16} /> : <Power size={16} />}
          </button>
        </form>
        <form action={deleteFilterRuleAction}>
          <input type="hidden" name="id" value={rule.id} />
          <button
            className="icon-button secondary compact-icon-button danger"
            type="submit"
            aria-label={`${rule.keyword} 삭제`}
            title="삭제"
          >
            <Trash2 size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function SetupState({ message }: { message: string }) {
  return (
    <section className="panel detail-main">
      <h2>키워드 설정을 준비해야 합니다</h2>
      <p className="notice-meta">{message}</p>
      <div className="detail-grid setup-grid">
        <div className="data-point">
          <span>1</span>
          <strong>
            <Database size={16} /> npm.cmd run db:init
          </strong>
        </div>
        <div className="data-point">
          <span>2</span>
          <strong>
            <Settings2 size={16} /> 키워드 설정 다시 열기
          </strong>
        </div>
      </div>
    </section>
  );
}
