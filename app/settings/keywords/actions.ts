"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createFilterRule,
  deleteFilterRule,
  isFilterRuleType,
  refreshStoredNoticeScoresForActiveKeywords,
  setFilterRuleEnabled
} from "@/lib/repositories/filter-rules";

const SETTINGS_PATH = "/settings/keywords";

export async function createFilterRuleAction(formData: FormData): Promise<void> {
  let destination = SETTINGS_PATH;

  try {
    const ruleType = formData.get("ruleType");
    const keyword = String(formData.get("keyword") ?? "");

    if (!isFilterRuleType(ruleType)) {
      throw new Error("알 수 없는 필터 유형입니다.");
    }

    await createFilterRule({
      ruleType,
      keyword
    });
    const refreshed = await refreshStoredNoticeScoresForActiveKeywords();
    revalidateKeywordPaths();
    destination = `${SETTINGS_PATH}?saved=${encodeURIComponent(`저장했습니다. 기존 공고 ${refreshed}건의 점수도 다시 계산했습니다.`)}`;
  } catch (error) {
    destination = `${SETTINGS_PATH}?error=${encodeURIComponent(getActionErrorMessage(error))}`;
  }

  redirect(destination);
}

export async function toggleFilterRuleAction(formData: FormData): Promise<void> {
  let destination = SETTINGS_PATH;

  try {
    const id = parseRuleId(formData.get("id"));
    const enabled = formData.get("enabled") === "true";

    await setFilterRuleEnabled(id, enabled);
    const refreshed = await refreshStoredNoticeScoresForActiveKeywords();
    revalidateKeywordPaths();
    destination = `${SETTINGS_PATH}?saved=${encodeURIComponent(`반영했습니다. 기존 공고 ${refreshed}건의 점수도 다시 계산했습니다.`)}`;
  } catch (error) {
    destination = `${SETTINGS_PATH}?error=${encodeURIComponent(getActionErrorMessage(error))}`;
  }

  redirect(destination);
}

export async function deleteFilterRuleAction(formData: FormData): Promise<void> {
  let destination = SETTINGS_PATH;

  try {
    const id = parseRuleId(formData.get("id"));

    await deleteFilterRule(id);
    const refreshed = await refreshStoredNoticeScoresForActiveKeywords();
    revalidateKeywordPaths();
    destination = `${SETTINGS_PATH}?saved=${encodeURIComponent(`삭제했습니다. 기존 공고 ${refreshed}건의 점수도 다시 계산했습니다.`)}`;
  } catch (error) {
    destination = `${SETTINGS_PATH}?error=${encodeURIComponent(getActionErrorMessage(error))}`;
  }

  redirect(destination);
}

function revalidateKeywordPaths(): void {
  revalidatePath("/");
  revalidatePath(SETTINGS_PATH);
}

function parseRuleId(value: FormDataEntryValue | null): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("필터 규칙을 찾을 수 없습니다.");
  }

  return id;
}

function getActionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "키워드 설정을 저장하지 못했습니다.";
}
