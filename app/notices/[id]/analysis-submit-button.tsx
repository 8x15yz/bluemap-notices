"use client";

import { FileText, LoaderCircle, Upload } from "lucide-react";
import type { MouseEvent } from "react";
import { useState } from "react";

type AnalysisButtonVariant = "upload" | "file";

type AnalysisSubmitButtonProps = {
  className?: string;
  estimateText?: string;
  idleLabel: string;
  pendingLabel?: string;
  variant: AnalysisButtonVariant;
};

export function AnalysisSubmitButton({
  className = "button",
  estimateText = "보통 30초~2분 정도 걸립니다. 파일이 크면 조금 더 걸릴 수 있습니다.",
  idleLabel,
  pendingLabel = "분석 중",
  variant
}: AnalysisSubmitButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const Icon = variant === "upload" ? Upload : FileText;

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    if (isPending) {
      event.preventDefault();
      return;
    }

    const form = event.currentTarget.form;

    if (form && !form.checkValidity()) {
      return;
    }

    setIsPending(true);
  }

  return (
    <div className="analysis-submit-state">
      <button className={className} type="submit" aria-busy={isPending} aria-disabled={isPending} onClick={handleClick}>
        {isPending ? <LoaderCircle className="spinner" size={16} /> : <Icon size={16} />}
        {isPending ? pendingLabel : idleLabel}
      </button>
      {isPending ? <p className="analysis-estimate">{estimateText}</p> : null}
    </div>
  );
}
