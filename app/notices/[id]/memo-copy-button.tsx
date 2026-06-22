"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyStatus = "idle" | "copied" | "failed";

export function MemoCopyButton({
  memo,
  idleLabel = "분석 복사"
}: {
  memo: string;
  idleLabel?: string;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const label = status === "copied" ? "복사 완료" : status === "failed" ? "복사 실패" : idleLabel;

  async function handleCopy(): Promise<void> {
    try {
      await copyText(memo);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("failed");
      window.setTimeout(() => setStatus("idle"), 1800);
    }
  }

  return (
    <button className="button secondary compact-button copy-button" type="button" onClick={handleCopy} aria-live="polite">
      {status === "copied" ? <Check size={15} /> : <Copy size={15} />}
      {label}
    </button>
  );
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await withTimeout(navigator.clipboard.writeText(text), 1000);
      return;
    } catch {
      await fallbackCopyText(text);
      return;
    }
  }

  await fallbackCopyText(text);
}

async function fallbackCopyText(text: string): Promise<void> {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");

    if (!copied) {
      throw new Error("Copy command failed.");
    }
  } finally {
    textarea.remove();
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("Clipboard write timed out.")), timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}
