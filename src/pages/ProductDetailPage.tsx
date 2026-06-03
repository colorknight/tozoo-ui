import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useParams } from "react-router-dom";
import { fetchCommodityById, releaseCommodity, setCommodityPrice } from "@/api/commodity";
import {
  COMMODITY_KIND_TABS,
  COMMODITY_TYPE_OPERATOR,
  COMMODITY_TYPE_PROCESS,
  type CommodityKindValue,
} from "@/api/commodity";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MarkdownView } from "@/components/MarkdownView";
import { JsonView } from "@/components/JsonView";
import {
  fetchCommodityVersionsForDetail,
  fetchOperatorImportHistoryAll,
  fetchVersionDownloadUrl,
  enableCommodityVersion,
  disableCommodityVersion,
  type CommodityVersionVo,
} from "@/api/commodityVersion";
import type { CommodityVo } from "@/types/commodity";

function normalizePortrait(raw: string): string {
  return raw.replace(/^\uFEFF/, "").trim();
}

function isSvgMarkup(s: string): boolean {
  const t = normalizePortrait(s);
  if (!t) return false;
  return t.startsWith("<") || /<svg[\s>/]/i.test(t);
}

function looksLikeBase64Only(s: string): boolean {
  const t = normalizePortrait(s);
  if (t.length < 32) return false;
  return /^[A-Za-z0-9+/=\s]+$/.test(t) && !t.includes("<");
}

function PortraitInline({
  portrait,
  size = "md",
}: {
  portrait?: string;
  size?: "sm" | "md";
}) {
  const raw = normalizePortrait(portrait ?? "");
  const box = size === "sm" ? "h-10 w-10 rounded-md" : "h-14 w-14 rounded-lg";
  const svgMax = size === "sm" ? "[&_svg]:max-h-7 [&_svg]:max-w-7" : "[&_svg]:max-h-10 [&_svg]:max-w-10";
  const imgMax = size === "sm" ? "max-h-7 max-w-7" : "max-h-10 max-w-10";
  if (!raw) {
    return (
      <div className={`flex ${box} items-center justify-center border border-admin-border bg-slate-50 text-[10px] text-slate-300`}>
        —
      </div>
    );
  }
  if (isSvgMarkup(raw)) {
    return (
      <div
        className={`flex ${box} items-center justify-center border border-admin-border bg-white p-1 ${svgMax} [&_svg]:object-contain`}
        dangerouslySetInnerHTML={{ __html: raw }}
      />
    );
  }
  if (looksLikeBase64Only(raw)) {
    return (
      <div className={`flex ${box} items-center justify-center border border-admin-border bg-white p-1`}>
        <img
          alt=""
          src={`data:image/svg+xml;base64,${raw.replace(/\s/g, "")}`}
          className={`${imgMax} object-contain`}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  return (
    <div className={`flex ${box} items-center justify-center border border-admin-border bg-slate-50 text-[10px] text-slate-300`}>
      —
    </div>
  );
}

type ProductDetailLocationState = {
  commodity?: CommodityVo;
  /** 从首页哪个 Tab 点进来，用于返回时恢复 */
  listKind?: CommodityKindValue;
};

function resolveHomeListKind(
  fromState: ProductDetailLocationState | null | undefined,
  row: CommodityVo | null,
): CommodityKindValue {
  const lk = fromState?.listKind;
  if (lk && COMMODITY_KIND_TABS.some((t) => t.value === lk)) return lk;
  const ct = row?.commodityType;
  if (ct && COMMODITY_KIND_TABS.some((t) => t.value === ct)) return ct as CommodityKindValue;
  return COMMODITY_TYPE_OPERATOR;
}

export function ProductDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = idParam ? decodeURIComponent(idParam) : "";
  const location = useLocation();
  const fromState = location.state as ProductDetailLocationState | null;

  const [commodity, setCommodity] = useState<CommodityVo | null>(fromState?.commodity ?? null);
  const [loading, setLoading] = useState(!fromState?.commodity);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verLoading, setVerLoading] = useState(false);
  const [verError, setVerError] = useState<string | null>(null);
  const [verItems, setVerItems] = useState<CommodityVersionVo[]>([]);
  const [verDownloading, setVerDownloading] = useState<string | null>(null);
  const [verEnabling, setVerEnabling] = useState(false);
  const [selectedVerId, setSelectedVerId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"help" | "i18n" | "flow">("help");
  const [releaseSubmitting, setReleaseSubmitting] = useState<"" | "UPPER" | "DOWN">("");
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceRmb, setPriceRmb] = useState<string>("");
  const [priceSubmitting, setPriceSubmitting] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  /** 忽略过期的版本列表请求（避免 effect 与启用/停用后的刷新竞态覆盖 UI） */
  const verListFetchGen = useRef(0);

  useEffect(() => {
    if (fromState?.commodity && fromState.commodity.id === id) {
      setCommodity(fromState.commodity);
      setLoading(false);
      setLoadError(null);
      return;
    }
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const nav = fromState?.commodity;
        const preferredFromNav =
          nav?.id === id &&
          nav.commodityType &&
          COMMODITY_KIND_TABS.some((t) => t.value === nav.commodityType)
            ? (nav.commodityType as CommodityKindValue)
            : undefined;
        const c = await fetchCommodityById(id, preferredFromNav);
        if (!cancelled) {
          setCommodity(c);
          if (!c) setLoadError("未找到该商品");
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, fromState?.commodity?.id]);

  useEffect(() => {
    if (!commodity?.id) return;
    const gen = ++verListFetchGen.current;
    let cancelled = false;
    void (async () => {
      setVerLoading(true);
      setVerError(null);
      try {
        const items = await fetchCommodityVersionsForDetail(commodity);
        if (cancelled || gen !== verListFetchGen.current) return;
        setVerItems(items);
        setSelectedVerId((prev) => prev || items[0]?.id || null);
      } catch (e) {
        if (cancelled || gen !== verListFetchGen.current) return;
        setVerError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled && gen === verListFetchGen.current) setVerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commodity?.id, commodity?.commodityType, commodity?.name]);

  const selectedVersion = useMemo(
    () => verItems.find((v) => v.id === selectedVerId) ?? null,
    [verItems, selectedVerId],
  );

  const commodityTypeUpper = (commodity?.commodityType ?? "").trim().toUpperCase();
  const isProcess = commodityTypeUpper === COMMODITY_TYPE_PROCESS;
  const isConnector = commodityTypeUpper === "CONNECTOR";

  useEffect(() => {
    if (isConnector || isProcess) return;
    setDetailTab("help");
  }, [selectedVerId, isConnector, isProcess]);

  if (loading) {
    return (
      <div className="rounded-lg border border-admin-border bg-admin-surface p-10 text-center text-sm text-admin-muted">
        加载中…
      </div>
    );
  }

  if (loadError || !commodity) {
    return (
      <div className="rounded-lg border border-admin-border bg-admin-surface p-10 text-center">
        <p className="text-sm text-slate-600">{loadError || "未找到该商品"}</p>
        <Link
          to="/"
          state={{ commodityKind: resolveHomeListKind(fromState, null) }}
          className="mt-4 inline-block text-sm font-medium text-admin-accent hover:text-admin-accent-hover"
        >
          返回目录
        </Link>
      </div>
    );
  }

  const downloadVersion = async (id: string) => {
    if (verDownloading) return;
    setVerDownloading(id);
    setVerError(null);
    try {
      const selected = verItems.find((v) => v.id === id);
      if (isProcess) {
        if (!selected) throw new Error("未找到可下载版本");
        const url = await fetchVersionDownloadUrl(selected.id);
        if (!url) throw new Error("未获取到下载链接");
        const a = document.createElement("a");
        a.href = url;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      let resolvedToDownload: CommodityVersionVo[] = [];
      const useDualFw =
        (commodityTypeUpper === "OPERATOR" || isConnector) &&
        Boolean((commodity.name || "").trim()) &&
        Boolean(selected?.version);
      if (!useDualFw) {
        resolvedToDownload = selected ? [selected] : [];
      } else if (isConnector) {
        // 连接器 history 不传 computionFramework，一次拉齐该版本下需下载的记录
        resolvedToDownload = (
          await fetchOperatorImportHistoryAll(commodity.name || "", [], 1, 200, {
            omitComputionFramework: true,
            commodityType: "CONNECTOR",
          })
        ).filter((v) => v.version === selected!.version);
      } else {
        // 算子：定义态(sengee) + 实现态(oyez) 各一条，按 version 聚合
        resolvedToDownload = (await fetchOperatorImportHistoryAll(commodity.name || "", ["sengee", "oyez"], 1, 200)).filter(
          (v) => v.version === selected!.version,
        );
      }
      if (resolvedToDownload.length === 0) {
        throw new Error("未找到可下载版本（定义态/实现态）");
      }
      for (const item of resolvedToDownload) {
        const url = await fetchVersionDownloadUrl(item.id);
        if (!url) throw new Error("未获取到下载链接");
        // 直接跳转到预签名 URL 下载，让 OSS 的 Content-Disposition 决定文件名
        // （避免前端用 blob 保存导致文件名/内容异常）
        const a = document.createElement("a");
        a.href = url;
        // 不强制新开标签，避免多文件下载被浏览器拦截；交由浏览器下载管理器处理
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      setVerError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerDownloading(null);
    }
  };

  const submitRelease = async (status: "UPPER" | "DOWN") => {
    if (releaseSubmitting) return;
    setReleaseSubmitting(status);
    setActionError(null);
    try {
      const updated = await releaseCommodity(commodity.id, status);
      setCommodity((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setReleaseSubmitting("");
    }
  };

  const openPriceModal = () => {
    setPriceError(null);
    setPriceRmb(commodity.price != null ? String(commodity.price) : "");
    setPriceOpen(true);
  };

  const closePriceModal = () => {
    if (priceSubmitting) return;
    setPriceOpen(false);
  };

  const submitPrice = async () => {
    const raw = priceRmb.trim();
    if (!raw) {
      setPriceError("请填写人民币价格（元）");
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setPriceError("价格必须是大于等于 0 的数字");
      return;
    }
    setPriceSubmitting(true);
    setPriceError(null);
    try {
      await setCommodityPrice(commodity.id, parsed);
      setCommodity((prev) => (prev ? { ...prev, price: parsed } : prev));
      setPriceOpen(false);
    } catch (e) {
      setPriceError(e instanceof Error ? e.message : String(e));
    } finally {
      setPriceSubmitting(false);
    }
  };

  const homeNavState = { commodityKind: resolveHomeListKind(fromState, commodity) };

  return (
    <div className="space-y-6">
      <nav className="text-sm text-admin-muted">
        <Link to="/" state={homeNavState} className="text-admin-accent hover:text-admin-accent-hover hover:underline">
          商品目录
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-700">详情</span>
      </nav>

      <div className="rounded-lg border border-admin-border bg-admin-surface shadow-sm">
        <div className="border-b border-admin-border px-6 py-4">
          <div className="space-y-3">
            {/* 第一行：标题 + 右侧返回 */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">
                  {commodity.alias?.trim() || commodity.name || "未命名"}
                </h2>
                {!isProcess &&
                  commodity.alias &&
                  commodity.name &&
                  commodity.alias !== commodity.name && (
                    <p className="mt-1 text-sm text-admin-muted">英文名：{commodity.name}</p>
                  )}
              </div>
              <Link
                to="/"
                state={homeNavState}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-admin-border bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span aria-hidden>←</span>
                返回
              </Link>
            </div>
            {/* 第二行：右侧操作上架/下架/价格 */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void submitRelease("UPPER")}
                disabled={releaseSubmitting !== ""}
                className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 disabled:opacity-50"
              >
                {releaseSubmitting === "UPPER" ? "上架中…" : "上架"}
              </button>
              <button
                type="button"
                onClick={() => void submitRelease("DOWN")}
                disabled={releaseSubmitting !== ""}
                className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {releaseSubmitting === "DOWN" ? "下架中…" : "下架"}
              </button>
              <button
                type="button"
                onClick={openPriceModal}
                className="rounded-md border border-teal-600/30 bg-white px-3 py-1.5 text-xs font-medium text-teal-700 shadow-sm transition-colors hover:bg-teal-50"
              >
                设置价格
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {actionError && (
            <ErrorBanner
              message={actionError}
              onClose={() => setActionError(null)}
              className="mb-3 rounded-lg px-3 py-2"
            />
          )}
          {verError && (
            <ErrorBanner message={verError} onClose={() => setVerError(null)} className="mb-3 rounded-lg px-3 py-2" />
          )}
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* 左：版本列表 */}
            <section className="overflow-hidden rounded-xl border border-admin-border bg-white">
              <div className="bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                版本列表
              </div>
              <div className="max-h-[62vh] overflow-auto">
                {verLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-admin-muted">加载中…</div>
                ) : verItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-admin-muted">暂无版本记录</div>
                ) : (
                  verItems.map((v) => {
                    const active = v.id === selectedVerId;
                    const enabled = Boolean(v.enabled);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVerId(v.id)}
                        className={[
                          "w-full border-t border-admin-border px-4 py-3 text-left transition-colors",
                          active ? "bg-teal-50/60" : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-slate-800">{v.version}</span>
                          {enabled ? (
                            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-medium text-white">
                              已启用
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                          {v.changeLog}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {/* 右：帮助文档 / 图标 + 选中版本详情 */}
            <section className="overflow-hidden rounded-xl border border-admin-border bg-white">
              <div className="border-b border-admin-border bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                详情
              </div>
              <div className="space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500">选中版本</div>
                    <div className="mt-1 flex items-center gap-2">
                      {!isProcess && <PortraitInline portrait={selectedVersion?.portrait} size="sm" />}
                      <div className="font-mono text-sm text-slate-800">
                        {selectedVersion?.version ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedVersion) return;
                        if (verEnabling) return;
                        setVerEnabling(true);
                        setVerError(null);
                        const gen = ++verListFetchGen.current;
                        try {
                          if (selectedVersion.enabled) {
                            await disableCommodityVersion(selectedVersion.id);
                          } else {
                            await enableCommodityVersion(selectedVersion.id);
                          }
                          const items = await fetchCommodityVersionsForDetail(commodity);
                          if (gen !== verListFetchGen.current) return;
                          setVerItems(items);
                        } catch (e) {
                          if (gen === verListFetchGen.current) {
                            setVerError(e instanceof Error ? e.message : String(e));
                          }
                        } finally {
                          setVerEnabling(false);
                          if (gen === verListFetchGen.current) setVerLoading(false);
                        }
                      }}
                      disabled={!selectedVersion || verEnabling}
                      className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {verEnabling ? "处理中…" : selectedVersion?.enabled ? "停用该版本" : "启用该版本"}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectedVersion && void downloadVersion(selectedVersion.id)}
                      disabled={!selectedVersion || verDownloading === selectedVersion?.id}
                      className="rounded-md border border-admin-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {verDownloading === selectedVersion?.id ? "生成中…" : "下载该版本"}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">变更记录</div>
                  <div className="mt-1 whitespace-pre-wrap rounded-lg border border-admin-border bg-slate-50/60 px-3 py-2 text-xs leading-relaxed text-slate-700">
                    {selectedVersion?.changeLog ?? "—"}
                  </div>
                </div>

                {commodity.commodityType !== "CONNECTOR" && (
                <div>
                  <div className="text-xs font-medium text-slate-500">资料</div>
                  <div className="mt-2 inline-flex rounded-lg border border-admin-border bg-white p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setDetailTab("help")}
                      className={[
                        "rounded-md px-3 py-1 font-medium transition-colors",
                        detailTab === "help" ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      帮助文档
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailTab("i18n")}
                      className={[
                        "rounded-md px-3 py-1 font-medium transition-colors",
                        detailTab === "i18n" ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      国际化文件
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailTab("flow")}
                      className={[
                        "rounded-md px-3 py-1 font-medium transition-colors",
                        detailTab === "flow" ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      用例流程
                    </button>
                  </div>

                  {detailTab === "help" && (
                    <>
                      {selectedVersion?.helpDoc?.trim() ? (
                        <div className="mt-3 max-h-[40vh] overflow-auto rounded-lg border border-admin-border bg-white px-3 py-2 text-sm leading-relaxed text-slate-700">
                          <MarkdownView markdown={selectedVersion.helpDoc} />
                        </div>
                      ) : selectedVersion?.description?.trim() ? (
                        <div
                          className="mt-3 max-h-[40vh] overflow-auto rounded-lg border border-admin-border bg-white px-3 py-2 text-sm leading-relaxed text-slate-700"
                          dangerouslySetInnerHTML={{ __html: selectedVersion.description }}
                        />
                      ) : (
                        <div className="mt-3 rounded-lg border border-admin-border bg-slate-50/60 px-3 py-2 text-sm text-slate-400">
                          暂无
                        </div>
                      )}
                    </>
                  )}

                  {detailTab === "i18n" && (
                    <>
                      {(() => {
                        const raw = selectedVersion?.i18nMessages;
                        if (raw != null) {
                          // 1) i18nMessages 为 JSON 字符串：先 parse
                          if (typeof raw === "string") {
                            const t = raw.trim();
                            if (t) {
                              try {
                                return <JsonView value={JSON.parse(t)} />;
                              } catch {
                                return (
                                  <pre className="mt-3 max-h-[40vh] overflow-auto rounded-lg border border-admin-border bg-slate-950 px-3 py-2 text-xs leading-relaxed text-slate-100">
                                    {raw}
                                  </pre>
                                );
                              }
                            }
                          }
                          // 2) i18nMessages 为对象/数组：直接展示
                          if (typeof raw === "object") {
                            return <JsonView value={raw} />;
                          }
                        }

                        // 3) 兜底：i18nFile
                        const file = selectedVersion?.i18nFile?.trim() || "";
                        if (file) {
                          try {
                            return <JsonView value={JSON.parse(file)} />;
                          } catch {
                            return (
                              <pre className="mt-3 max-h-[40vh] overflow-auto rounded-lg border border-admin-border bg-slate-950 px-3 py-2 text-xs leading-relaxed text-slate-100">
                                {selectedVersion?.i18nFile}
                              </pre>
                            );
                          }
                        }

                        return (
                        <div className="mt-3 rounded-lg border border-admin-border bg-slate-50/60 px-3 py-2 text-sm text-slate-400">
                          暂无
                        </div>
                        );
                      })()}
                    </>
                  )}

                  {detailTab === "flow" && (
                    <>
                      {selectedVersion?.useCaseFlow?.trim() ? (
                        <div className="mt-3 max-h-[40vh] overflow-auto rounded-lg border border-admin-border bg-white px-3 py-2 text-sm leading-relaxed text-slate-700">
                          <div className="whitespace-pre-wrap">{selectedVersion.useCaseFlow}</div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-admin-border bg-slate-50/60 px-3 py-2 text-sm text-slate-400">
                          暂无
                        </div>
                      )}
                    </>
                  )}
                </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {priceOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-dialog-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closePriceModal();
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="price-dialog-title" className="text-lg font-semibold text-slate-800">
                设置商品价格
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                币种固定人民币（CNH）。填写 0 表示免费。
              </p>
              <label className="mt-4 block text-sm text-slate-700">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  人民币价格（元）
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceRmb}
                  onChange={(e) => setPriceRmb(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                  placeholder="例如 0 或 199"
                  autoComplete="off"
                />
              </label>
              {priceError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{priceError}</p>
              )}
              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closePriceModal}
                  disabled={priceSubmitting}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void submitPrice()}
                  disabled={priceSubmitting}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  {priceSubmitting ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
