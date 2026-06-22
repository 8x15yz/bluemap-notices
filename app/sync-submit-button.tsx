"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

type SyncState =
  | { status: "idle" }
  | { status: "loading"; phase: string; fetched: number; page: number; maxPages: number; processed: number; candidates: number }
  | { status: "done"; fetched: number; stored: number; candidates: number; notified: number }
  | { status: "error"; message: string };

export function SyncSubmitButton() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>({ status: "idle" });

  const handleSync = useCallback(async () => {
    setState({ status: "loading", phase: "시작 중", fetched: 0, page: 0, maxPages: 0, processed: 0, candidates: 0 });

    try {
      const response = await fetch("/api/sync", {
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok || !response.body) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(errorBody || "동기화 요청에 실패했습니다.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

            if (event.phase === "fetching") {
              setState((prev) =>
                prev.status === "loading"
                  ? {
                      ...prev,
                      phase: "공고 조회 중",
                      fetched: Number(event.fetched),
                      page: Number(event.page),
                      maxPages: Number(event.maxPages),
                    }
                  : prev
              );
            } else if (event.phase === "processing") {
              setState((prev) =>
                prev.status === "loading"
                  ? {
                      ...prev,
                      phase: "공고 처리 중",
                      fetched: Number(event.fetched),
                      processed: Number(event.processed),
                      candidates: Number(event.candidates),
                    }
                  : prev
              );
            } else if (event.phase === "done") {
              setState({
                status: "done",
                fetched: Number(event.fetched),
                stored: Number(event.stored),
                candidates: Number(event.candidates),
                notified: Number(event.notified),
              });
              router.refresh();
              return;
            } else if (event.phase === "error") {
              setState({ status: "error", message: String(event.message) });
              return;
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "동기화에 실패했습니다." });
    }
  }, [router]);

  if (state.status === "loading") {
    return (
      <div className="sync-progress">
        <button className="button sync-button" type="button" disabled aria-busy="true">
          <LoaderCircle className="spinner" size={16} />
          {state.phase}
        </button>
        <div className="sync-progress-detail">
          {state.fetched > 0 && <span>{state.fetched.toLocaleString("ko-KR")}건 수신</span>}
          {state.page > 0 && state.maxPages > 0 && (
            <span>페이지 {state.page}/{state.maxPages}</span>
          )}
          {state.candidates > 0 && <span>후보 {state.candidates}건</span>}
          {state.processed > 0 && <span>처리 {state.processed}건</span>}
        </div>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <div className="sync-progress">
        <button
          className="button sync-button secondary"
          type="button"
          onClick={() => setState({ status: "idle" })}
        >
          <CheckCircle2 size={16} />
          조회 완료 — 다시 조회
        </button>
        <div className="sync-progress-detail">
          <span>수신 {state.fetched.toLocaleString("ko-KR")}건</span>
          <span>후보 {state.candidates}건</span>
          <span>저장 {state.stored}건</span>
          <span>Slack {state.notified}건</span>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="sync-progress">
        <button className="button sync-button" type="button" onClick={handleSync}>
          <RefreshCw size={16} />
          다시 시도
        </button>
        <p className="sync-error">
          <AlertCircle size={13} />
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <button className="button sync-button" type="button" onClick={handleSync}>
      <RefreshCw size={16} />
      공고 조회
    </button>
  );
}
