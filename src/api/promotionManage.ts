import { apiBase, i18nHeader } from "@/api/config";
import { apiErrorMessage } from "@/api/apiError";
import type { SpringPage } from "@/types/springPage";

export type PromotionManageVo = {
  id: string;
  name?: string;
  alias?: string;
  rangeStart?: string;
  rangeEnd?: string;
  couponIds?: string[];
  couponCount: number;
};

export type PromotionSaveDto = {
  id?: string;
  name: string;
  alias?: string;
  couponIds?: string[];
  rangeStart?: string;
  rangeEnd?: string;
};

function basePath(): string {
  const b = apiBase();
  return b ? `${b}/member/manage/promotion` : "/member/manage/promotion";
}

export async function fetchPromotionPage(
  pageNumber = 1,
  pageSize = 20,
): Promise<SpringPage<PromotionManageVo>> {
  const sp = new URLSearchParams();
  sp.set("pageNumber", String(pageNumber));
  sp.set("pageSize", String(pageSize));
  const res = await fetch(`${basePath()}/page?${sp}`, {
    headers: { I18n: i18nHeader(), Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(apiErrorMessage("获取活动列表", res, text));
  return JSON.parse(text) as SpringPage<PromotionManageVo>;
}

export async function savePromotion(dto: PromotionSaveDto): Promise<PromotionManageVo> {
  const res = await fetch(`${basePath()}/save`, {
    method: "POST",
    headers: {
      I18n: i18nHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(apiErrorMessage("保存活动", res, text));
  return JSON.parse(text) as PromotionManageVo;
}

export async function deletePromotion(id: string): Promise<void> {
  const res = await fetch(`${basePath()}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { I18n: i18nHeader() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(apiErrorMessage("删除活动", res, text));
  }
}
