import { apiBase, i18nHeader } from "@/api/config";
import { apiErrorMessage } from "@/api/apiError";
import type { CommodityVo } from "@/types/commodity";
import type { SpringPage } from "@/types/springPage";

export type CommodityVersionVo = {
  id: string;
  commodityId: string;
  commodityName?: string;
  computionFramework?: string;
  commodityType?: string;
  version: string;
  changeLog: string;
  kind: string;
  ossVersion?: string;
  createdTime?: string;
  enabled?: boolean;
  portrait?: string;
  description?: string;
  /** markdown：帮助文档 */
  helpDoc?: string;
  /** 国际化文件内容（可选；后端若返回则直接展示） */
  i18nFile?: string;
  /** 国际化（接口字段：i18nMessages；可能是对象，也可能是 JSON 字符串） */
  i18nMessages?: unknown;
  /** 用例流程（可选；后端若返回则直接展示） */
  useCaseFlow?: string;
};

function basePath(): string {
  const b = apiBase();
  return b ? `${b}/member/manage/commodity/version` : "/member/manage/commodity/version";
}

export async function fetchCommodityVersions(
  commodityId: string,
  kind: "operator" | "connector" | "process",
  pageNumber = 1,
  pageSize = 20,
): Promise<SpringPage<CommodityVersionVo>> {
  const sp = new URLSearchParams();
  sp.set("commodityId", commodityId);
  sp.set("kind", kind);
  sp.set("pageNumber", String(pageNumber));
  sp.set("pageSize", String(pageSize));
  const res = await fetch(`${basePath()}/page?${sp.toString()}`, {
    headers: { I18n: i18nHeader(), Accept: "application/json" },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(apiErrorMessage("获取版本列表", res, text));
  return JSON.parse(text) as SpringPage<CommodityVersionVo>;
}

export async function fetchVersionDownloadUrl(versionId: string): Promise<string> {
  const sp = new URLSearchParams();
  sp.set("versionId", versionId);
  const res = await fetch(`${basePath()}/download-url?${sp.toString()}`, {
    // 兼容两种后端返回：
    // 1) 直接返回字符串 URL
    // 2) 返回统一包装 { code, message, result: "<url>" }
    headers: { I18n: i18nHeader(), Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(apiErrorMessage("获取下载链接", res, text));
  const t = text.trim();
  if (!t) return "";
  if (t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t) as { result?: unknown };
      const url = typeof parsed?.result === "string" ? parsed.result.trim() : "";
      if (url) return url;
    } catch {
      // fall through
    }
  }
  return t;
}

export async function enableCommodityVersion(versionId: string): Promise<void> {
  const sp = new URLSearchParams();
  sp.set("versionId", versionId);
  sp.set("enabled", "true");
  const res = await fetch(`${basePath()}/enable?${sp.toString()}`, {
    method: "POST",
    headers: { I18n: i18nHeader(), Accept: "text/plain" },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(apiErrorMessage("启用版本", res, text));
}

export async function disableCommodityVersion(versionId: string): Promise<void> {
  const sp = new URLSearchParams();
  sp.set("versionId", versionId);
  sp.set("enabled", "false");
  const res = await fetch(`${basePath()}/enable?${sp.toString()}`, {
    method: "POST",
    headers: { I18n: i18nHeader(), Accept: "text/plain" },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(apiErrorMessage("停用版本", res, text));
}

export type FetchImportHistoryOptions = {
  /** 不传 `computionFramework`（连接器、流程等） */
  omitComputionFramework?: boolean;
  /** 商品类型，默认 OPERATOR */
  commodityType?: string;
};

/** @deprecated 使用 {@link FetchImportHistoryOptions} */
export type FetchOperatorImportHistoryOptions = FetchImportHistoryOptions;

async function fetchImportHistoryPage(
  root: string,
  name: string,
  pageNo: number,
  pageSize: number,
  computionFramework?: string,
  commodityType = "OPERATOR",
): Promise<CommodityVersionVo[]> {
  const sp = new URLSearchParams();
  sp.set("operatorName", name);
  sp.set("commodityType", commodityType);
  const fw = (computionFramework || "").trim();
  if (fw) sp.set("computionFramework", fw);
  sp.set("pageNo", String(pageNo));
  sp.set("pageSize", String(pageSize));
  const res = await fetch(`${root}?${sp.toString()}`, {
    headers: { I18n: i18nHeader(), Accept: "application/json" },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) return [];
  const parsed = (text ? JSON.parse(text) : null) as unknown;
  // 兼容两种返回：数组（新接口示例）或 SpringPage（部分环境可能仍返回分页结构）
  if (Array.isArray(parsed)) return parsed as CommodityVersionVo[];
  if (Array.isArray((parsed as SpringPage<CommodityVersionVo> | null)?.content)) {
    return (parsed as SpringPage<CommodityVersionVo>).content as CommodityVersionVo[];
  }
  return [];
}

export async function fetchOperatorImportHistoryAll(
  operatorName: string,
  frameworks: string[] = ["sengee", "oyez", "gosooz"],
  pageNo = 1,
  pageSize = 50,
  options?: FetchImportHistoryOptions,
): Promise<CommodityVersionVo[]> {
  return fetchImportHistoryAll(operatorName, frameworks, pageNo, pageSize, options);
}

export async function fetchImportHistoryAll(
  commodityName: string,
  frameworks: string[] = ["sengee", "oyez", "gosooz"],
  pageNo = 1,
  pageSize = 50,
  options?: FetchImportHistoryOptions,
): Promise<CommodityVersionVo[]> {
  const name = (commodityName || "").trim();
  if (!name) return [];
  const commodityType = (options?.commodityType || "OPERATOR").trim().toUpperCase();
  const b = apiBase();
  const root = b
    ? `${b}/member/manage/commodity/version/history`
    : "/member/manage/commodity/version/history";
  const merged: CommodityVersionVo[] = [];
  const seen = new Set<string>();

  const pushItems = (items: CommodityVersionVo[]) => {
    for (const it of items) {
      if (!it?.id || seen.has(it.id)) continue;
      seen.add(it.id);
      merged.push(it);
    }
  };

  if (options?.omitComputionFramework) {
    pushItems(await fetchImportHistoryPage(root, name, pageNo, pageSize, undefined, commodityType));
  } else {
    for (const fw of frameworks) {
      const framework = (fw || "").trim();
      if (!framework) continue;
      pushItems(await fetchImportHistoryPage(root, name, pageNo, pageSize, framework, commodityType));
    }
  }

  merged.sort((a, b) => {
    const ta = a.createdTime ? new Date(a.createdTime).getTime() : 0;
    const tb = b.createdTime ? new Date(b.createdTime).getTime() : 0;
    return tb - ta;
  });
  return merged;
}

/**
 * 详情/列表快捷弹窗用的版本列表：
 * - 算子：`history` + sengee 框架
 * - 连接器 / 流程：`history` + commodityType，不传框架
 * - 其余：`GET .../version/page?commodityId=&kind=`
 */
export async function fetchCommodityVersionsForDetail(c: CommodityVo): Promise<CommodityVersionVo[]> {
  const type = (c.commodityType || "").trim().toUpperCase();
  const name = (c.name || "").trim();
  if (type === "CONNECTOR" && name) {
    return fetchImportHistoryAll(name, [], 1, 50, {
      omitComputionFramework: true,
      commodityType: "CONNECTOR",
    });
  }
  if (type === "PROCESS" && name) {
    return fetchImportHistoryAll(name, [], 1, 50, {
      omitComputionFramework: true,
      commodityType: "PROCESS",
    });
  }
  if (type === "OPERATOR" && name) {
    return fetchImportHistoryAll(name, ["sengee"], 1, 50, { commodityType: "OPERATOR" });
  }
  if (c.id) {
    const pageKind: "operator" | "connector" | "process" =
      type === "CONNECTOR" ? "connector" : type === "PROCESS" ? "process" : "operator";
    return (await fetchCommodityVersions(c.id, pageKind, 1, 50)).content;
  }
  return [];
}
