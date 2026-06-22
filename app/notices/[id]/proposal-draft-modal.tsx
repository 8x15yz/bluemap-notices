"use client";

import { Check, FileText, LoaderCircle, MessageSquareText, Send, Sparkles, X } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { MemoCopyButton } from "@/app/notices/[id]/memo-copy-button";
import type { ProposalDraft } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils/dates";

export type ProposalAnalysisReportOption = {
  id: number;
  fileName: string;
  modelProvider: string;
  createdAt: string;
};

type ProposalDraftModalProps = {
  noticeId: string;
  reports: ProposalAnalysisReportOption[];
  initialDrafts: ProposalDraft[];
};

type RequestState = "idle" | "generating" | "revising";

export function ProposalDraftModal({ noticeId, reports, initialDrafts }: ProposalDraftModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [drafts, setDrafts] = useState<ProposalDraft[]>(initialDrafts);
  const [selectedReportId, setSelectedReportId] = useState<number>(
    initialDrafts[0]?.analysisReportId ?? reports[0]?.id ?? 0
  );
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedReport = reports.find((report) => report.id === selectedReportId);
  const selectedDraft = drafts.find((draft) => draft.analysisReportId === selectedReportId);
  const hasReports = reports.length > 0;
  const isBusy = requestState !== "idle";
  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reports]
  );

  async function handleGenerate(): Promise<void> {
    if (!selectedReportId || isBusy) {
      return;
    }

    setError(null);
    setRequestState("generating");

    try {
      const draft = await postJson<{ draft: ProposalDraft }>(`/api/notices/${encodeURIComponent(noticeId)}/proposal-drafts`, {
        analysisReportId: selectedReportId
      });
      mergeDraft(draft.draft);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "제안서 초안 생성에 실패했습니다.");
    } finally {
      setRequestState("idle");
    }
  }

  async function handleRevise(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!selectedDraft || isBusy) {
      return;
    }

    const nextMessage = message.trim();

    if (!nextMessage) {
      setError("수정 요청을 입력해주세요.");
      return;
    }

    setError(null);
    setRequestState("revising");

    try {
      const result = await postJson<{ draft: ProposalDraft }>(
        `/api/notices/${encodeURIComponent(noticeId)}/proposal-drafts/${selectedDraft.id}/messages`,
        {
          message: nextMessage
        }
      );
      mergeDraft(result.draft);
      setMessage("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "제안서 초안 수정에 실패했습니다.");
    } finally {
      setRequestState("idle");
    }
  }

  function mergeDraft(nextDraft: ProposalDraft): void {
    setDrafts((currentDrafts) => [
      nextDraft,
      ...currentDrafts.filter(
        (draft) => draft.id !== nextDraft.id && draft.analysisReportId !== nextDraft.analysisReportId
      )
    ]);
    setSelectedReportId(nextDraft.analysisReportId);
  }

  if (!hasReports) {
    return (
      <div className="proposal-entry">
        <button className="button secondary" type="button" disabled>
          <Sparkles size={16} />
          제안서 초안 작성하기
        </button>
        <p>먼저 첨부파일 분석을 완료하세요.</p>
      </div>
    );
  }

  return (
    <div className="proposal-entry">
      <button className="button secondary" type="button" onClick={() => setIsOpen(true)}>
        <Sparkles size={16} />
        제안서 초안 작성하기
      </button>

      {drafts.length > 0 ? (
        <p>
          <Check size={13} />
          저장된 초안 {drafts.length}건
        </p>
      ) : (
        <p>분석 파일을 선택해 초안을 작성합니다.</p>
      )}

      {isOpen ? (
        <div
          className="proposal-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isBusy) {
              setIsOpen(false);
            }
          }}
        >
          <section className="proposal-modal" role="dialog" aria-modal="true" aria-labelledby="proposal-modal-title">
            <div className="proposal-modal-header">
              <div>
                <span className="proposal-kicker">제안서 초안</span>
                <h2 id="proposal-modal-title">분석 파일 기준으로 초안을 작성합니다</h2>
              </div>
              <button className="icon-button secondary compact-icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="닫기" disabled={isBusy}>
                <X size={17} />
              </button>
            </div>

            <div className="proposal-modal-body">
              <aside className="proposal-source-panel">
                <label className="field-label" htmlFor="proposal-report">
                  분석 파일
                </label>
                <select
                  id="proposal-report"
                  className="select-input"
                  value={selectedReportId}
                  onChange={(event) => {
                    setSelectedReportId(Number(event.target.value));
                    setError(null);
                  }}
                  disabled={isBusy}
                >
                  {sortedReports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.fileName}
                    </option>
                  ))}
                </select>

                {selectedReport ? (
                  <div className="proposal-source-meta">
                    <span>{selectedReport.modelProvider}</span>
                    <span>{formatDateLabel(selectedReport.createdAt)}</span>
                    {selectedDraft ? <strong>저장된 초안 있음</strong> : <strong>초안 미작성</strong>}
                  </div>
                ) : null}

                {selectedDraft ? (
                  <MemoCopyButton memo={selectedDraft.contentMarkdown} idleLabel="초안 복사" />
                ) : (
                  <button className="button" type="button" onClick={handleGenerate} disabled={isBusy || !selectedReportId}>
                    {requestState === "generating" ? <LoaderCircle className="spinner" size={16} /> : <FileText size={16} />}
                    초안 생성
                  </button>
                )}

                {isBusy ? <p className="proposal-estimate">보통 30초~2분 걸립니다.</p> : null}
                {error ? <div className="proposal-error">{error}</div> : null}
              </aside>

              <section className="proposal-draft-panel">
                {selectedDraft ? (
                  <>
                    <div className="proposal-draft-header">
                      <div>
                        <strong>{selectedReport?.fileName ?? "분석 파일"}</strong>
                        <span>{formatDateLabel(selectedDraft.updatedAt)} 저장</span>
                      </div>
                    </div>
                    <pre className="proposal-markdown">{selectedDraft.contentMarkdown}</pre>
                  </>
                ) : (
                  <div className="proposal-empty">
                    <FileText size={24} />
                    <strong>선택한 분석 파일로 초안을 생성하세요.</strong>
                    <span>제안요청서 양식과 블루맵 기술특장점을 함께 반영합니다.</span>
                  </div>
                )}
              </section>

              <aside className="proposal-chat-panel">
                <div className="proposal-chat-header">
                  <MessageSquareText size={16} />
                  <strong>수정 요청</strong>
                </div>

                <div className="proposal-message-list">
                  {selectedDraft?.messages.length ? (
                    selectedDraft.messages.map((draftMessage) => (
                      <div className={`proposal-message ${draftMessage.role}`} key={draftMessage.id}>
                        <span>{draftMessage.role === "user" ? "요청" : "AI"}</span>
                        <p>{draftMessage.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="proposal-message-empty">초안 생성 후 보완 요청을 남길 수 있습니다.</div>
                  )}
                </div>

                <form className="proposal-chat-form" onSubmit={handleRevise}>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="예: 평가 기준에 맞춰 기술 차별화 문장을 더 강하게 써줘"
                    disabled={!selectedDraft || isBusy}
                  />
                  <button className="button" type="submit" disabled={!selectedDraft || isBusy || !message.trim()}>
                    {requestState === "revising" ? <LoaderCircle className="spinner" size={16} /> : <Send size={16} />}
                    반영
                  </button>
                </form>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "요청 처리에 실패했습니다.");
  }

  return payload as T;
}
