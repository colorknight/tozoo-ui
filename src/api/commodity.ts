import { apiBase, i18nHeader } from "@/api/config";
import { apiErrorMessage } from "@/api/apiError";
import type { CommodityVo, PageCommodityVo } from "@/types/commodity";

/** 与后端 `CommodityType` 枚举名一致 */
export const COMMODITY_TYPE_OPERATOR = "OPERATOR";
export const COMMODITY_TYPE_CONNECTOR = "CONNECTOR";
/** 流程（后端枚举为 PROCESS） */
export const COMMODITY_TYPE_PROCESS = "PROCESS";

/** 管理端顶部分类 Tab：算子 / 连接器 / 流程 */
export const COMMODITY_KIND_TABS = [
  {
    value: COMMODITY_TYPE_OPERATOR,
    label: "算子",
    description: "算法与算子类扩展包",
  },
  {
    value: COMMODITY_TYPE_CONNECTOR,
    label: "连接器",
    description: "数据源与连接器",
  },
  {
    value: COMMODITY_TYPE_PROCESS,
    label: "流程",
    description: "流程编排类商品",
  },
] as const;

export type CommodityKindValue = (typeof COMMODITY_KIND_TABS)[number]["value"];

export type CommodityListQuery = {
  pageNumber?: number;
  pageSize?: number;
  name?: string;
  commodityStatus?: "UPPER" | "DOWN" | string;
  /** 默认 `OPERATOR`（算子）；传其它值可覆盖 */
  type?: string;
  /** 切换 Tab 时中止上一次列表请求，避免旧响应覆盖新分类 */
  signal?: AbortSignal;
};

function listUrl(): string {
  const base = apiBase();
  return base ? `${base}/member/commodity/list` : "/member/commodity/list";
}

/**
 * GET /member/commodity/list 分页查询商品
 * pageNumber 与后端一致：从 1 开始（首页为 1）
 */
export async function fetchCommodityList(
  query: CommodityListQuery = {}
): Promise<PageCommodityVo> {
  const { pageNumber = 1, pageSize = 12, name, commodityStatus, type, signal } =
    query;

  const sp = new URLSearchParams();
  sp.set("pageNumber", String(pageNumber));
  sp.set("pageSize", String(pageSize));
  const n = name?.trim() ?? "";
  if (n) sp.set("name", n);
  const t = (type?.trim() || COMMODITY_TYPE_OPERATOR);
  sp.set("type", t);
  const cs = commodityStatus?.trim() ?? "";
  if (cs) sp.set("commodityStatus", cs);

  const href = `${listUrl()}?${sp.toString()}`;

  const res = await fetch(href, {
    method: "GET",
    headers: {
      I18n: i18nHeader(),
      Accept: "application/json",
    },
    signal,
  });

  const text = await res.text().catch(() => "");
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      throw new Error(apiErrorMessage("获取商品列表", res, text));
    }
    throw new Error("商品列表: 响应不是合法 JSON");
  }

  // 后端若误返回 5xx 但 body 仍是 Spring Page JSON，仍按成功解析（避免界面红字）
  if (parsed && isPageCommodityVo(parsed)) {
    return parsed;
  }

  if (!res.ok) {
    throw new Error(apiErrorMessage("获取商品列表", res, text));
  }

  throw new Error("商品列表: 响应格式与分页结构不符");
}

function isPageCommodityVo(data: unknown): data is PageCommodityVo {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    Array.isArray(o.content) &&
    typeof o.totalElements === "number" &&
    typeof o.totalPages === "number"
  );
}

/** 无按 id 查询接口时：在算子 / 连接器 / 流程下分页查找 */
export async function fetchCommodityById(
  id: string,
  preferredType?: CommodityKindValue,
): Promise<CommodityVo | null> {
  const pageSize = 50;
  const maxPages = 40;
  const all: CommodityKindValue[] = [
    COMMODITY_TYPE_OPERATOR,
    COMMODITY_TYPE_CONNECTOR,
    COMMODITY_TYPE_PROCESS,
  ];
  const types: CommodityKindValue[] =
    preferredType && all.includes(preferredType)
      ? [preferredType, ...all.filter((t) => t !== preferredType)]
      : all;

  for (const type of types) {
    let page = 1;
    while (page <= maxPages) {
      const data = await fetchCommodityList({ pageNumber: page, pageSize, type });
      const found = data.content.find((c) => c.id === id);
      if (found) return found;
      if (data.last || data.empty) break;
      page++;
    }
  }

  return null;
}

/** POST /member/commodity/price/{id} — 设置商品人民币售价（元） */
export async function setCommodityPrice(
  commodityId: string,
  priceRmb: number,
): Promise<void> {
  const base = apiBase();
  const path = `/member/commodity/price/${encodeURIComponent(commodityId)}`;
  const sp = new URLSearchParams();
  sp.set("price", String(priceRmb));
  const href = base ? `${base}${path}?${sp.toString()}` : `${path}?${sp.toString()}`;

  const res = await fetch(href, {
    method: "POST",
    headers: {
      I18n: i18nHeader(),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(apiErrorMessage("设置价格", res, text));
  }
}

/** POST /member/commodity/release/{id}/{status} — 上下架商品 */
export async function releaseCommodity(
  commodityId: string,
  status: "UPPER" | "DOWN",
): Promise<CommodityVo> {
  const base = apiBase();
  const path = `/member/commodity/release/${encodeURIComponent(commodityId)}/${encodeURIComponent(status)}`;
  const href = base ? `${base}${path}` : path;
  const res = await fetch(href, {
    method: "POST",
    headers: {
      I18n: i18nHeader(),
      Accept: "application/json",
    },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(apiErrorMessage("上下架", res, text));
  }
  return text ? (JSON.parse(text) as CommodityVo) : ({} as CommodityVo);
}

export type DeleteCommodityResult = {
  commodityId: string;
  commodityName: string;
  commodityType: string;
  deleteOss: boolean;
  deletedCommodity: boolean;
  deletedVersionCount: number;
  ossDeletedCount: number;
  ossDeleteFailedCount: number;
  deletedVersions: Array<{
    versionId: string;
    framework: string;
    version: string;
    kind: string;
    ossObjectKey: string;
    ossDeleted: boolean;
  }>;
};

/** POST /member/commodity/importCommodity/process — multipart 表单 */
export type ImportProcessCommodityParams = {
  /** 变更记录（必填） */
  changeLog: string;
  /** `.flow` 流程文件（OpenAPI 标为可选，管理端导入时仍应上传） */
  file?: File;
};

/**
 * 导入流程商品
 *
 * - 方法：`POST`
 * - Content-Type：`multipart/form-data`
 * - 字段：`changeLog`（必填）、`file`（可选）
 * - 成功：`201 Created`，body 为 `Commodity`
 */
export async function importProcessCommodity(
  params: ImportProcessCommodityParams,
): Promise<CommodityVo> {
  const changeLog = params.changeLog.trim();
  if (!changeLog) {
    throw new Error("请填写变更记录（说明）");
  }

  const base = apiBase();
  const path = "/member/commodity/importCommodity/process";
  const href = base ? `${base}${path}` : path;
  const fd = new FormData();
  fd.append("changeLog", changeLog);
  if (params.file) {
    fd.append("file", params.file, params.file.name);
  }

  const res = await fetch(href, {
    method: "POST",
    headers: {
      I18n: i18nHeader(),
      Accept: "application/json",
    },
    body: fd,
  });

  const text = await res.text().catch(() => "");
  const ok = res.ok || res.status === 201;
  if (!ok) {
    throw new Error(apiErrorMessage("导入流程", res, text));
  }
  if (!text.trim()) {
    return {
      id: "",
      name: params.file?.name ?? "",
      commodityType: COMMODITY_TYPE_PROCESS,
      price: 0,
    };
  }
  try {
    return JSON.parse(text) as CommodityVo;
  } catch {
    throw new Error("导入流程: 响应不是合法 JSON");
  }
}

/** @deprecated 使用 {@link importProcessCommodity} */
export async function uploadProcessCommodityFlow(
  file: File,
  changeLog: string,
): Promise<CommodityVo> {
  return importProcessCommodity({ file, changeLog });
}

/** DELETE /member/manage/commodity/delete — 删除商品（含版本与 OSS） */
export async function deleteCommodity(
  commodityId: string,
  deleteOss = true,
): Promise<DeleteCommodityResult> {
  const base = apiBase();
  const path = `/member/manage/commodity/delete?commodityId=${encodeURIComponent(commodityId)}&deleteOss=${deleteOss}`;
  const href = base ? `${base}${path}` : path;
  const res = await fetch(href, {
    method: "DELETE",
    headers: {
      I18n: i18nHeader(),
      Accept: "application/json",
    },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(apiErrorMessage("删除商品", res, text));
  }
  return text ? (JSON.parse(text) as DeleteCommodityResult) : ({} as DeleteCommodityResult);
}
