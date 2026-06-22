"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncG2bNotices } from "@/lib/services/sync";

export async function syncNowAction(): Promise<void> {
  let destination = "/";

  try {
    const summary = await syncG2bNotices();
    revalidatePath("/");
    destination = `/?sync=${encodeURIComponent(
      `조회 ${summary.fetched}건 · 후보 ${summary.candidates}건 · Slack ${summary.notified}건`
    )}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "동기화에 실패했습니다.";
    destination = `/?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
