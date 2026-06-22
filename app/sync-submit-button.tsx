"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SyncSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button sync-button" type="submit" aria-busy={pending} disabled={pending}>
      {pending ? <LoaderCircle className="spinner" size={16} /> : <RefreshCw size={16} />}
      {pending ? "조회 중" : "공고 조회"}
    </button>
  );
}
