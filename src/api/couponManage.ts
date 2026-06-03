import { apiBase, i18nHeader } from "@/api/config";
import { apiErrorMessage } from "@/api/apiError";
import type { SpringPage } from "@/types/springPage";

export type CouponKind = "CASH_DISCOUNT" | "OFF_DISCOUNT" | "VOUCHER";

export type CouponManageVo = {
  id: string;
  name?: string;
  alias?: string;
  kind: string;
  couponType?: string;
  startTime?: string;
  endTime?: string;
  amount?: number;
  discount?: number;
  off?: number;
  commodityId?: string;
};

export type CouponCreateDto = {
  kind: CouponKind;
  name: string;
  alias?: string;
  startTime: string;
  endTime: string;
  couponType?: string;
  amount?: number;
  discount?: number;
  off?: number;
  commodityId?: string;
};

function basePath(): string {
  const b = apiBase();
  return b ? `${b}/member/manage/coupon` : "/member/manage/coupon";
}

export async function fetchCouponPage(
  pageNumber = 1,
  pageSize = 20,
): Promise<SpringPage<CouponManageVo>> {
  const sp = new URLSearchParams();
  sp.set("pageNumber", String(pageNumber));
  sp.set("pageSize", String(pageSize));
  const res = await fetch(`${basePath()}/page?${sp}`, {
    headers: { I18n: i18nHeader(), Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(apiErrorMessage("获取消费券列表", res, text));
  return JSON.parse(text) as SpringPage<CouponManageVo>;
}

export async function createCoupon(dto: CouponCreateDto): Promise<CouponManageVo> {
  const res = await fetch(basePath(), {
    method: "POST",
    headers: {
      I18n: i18nHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(apiErrorMessage("新建消费券", res, text));
  return JSON.parse(text) as CouponManageVo;
}

export async function deleteCoupon(id: string): Promise<void> {
  const res = await fetch(`${basePath()}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { I18n: i18nHeader() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(apiErrorMessage("删除消费券", res, text));
  }
}
