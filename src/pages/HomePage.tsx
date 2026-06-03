import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CommodityCard } from "@/components/CommodityCard";
import { CommodityQuickManageModal } from "@/components/CommodityQuickManageModal";
import { ProcessCommodityTable } from "@/components/ProcessCommodityTable";
import { ProcessUploadModal } from "@/components/ProcessUploadModal";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useDialog } from "@/components/DialogProvider";
import {
  COMMODITY_KIND_TABS,
  COMMODITY_TYPE_OPERATOR,
  COMMODITY_TYPE_PROCESS,
  deleteCommodity,
  fetchCommodityList,
  type CommodityKindValue,
} from "@/api/commodity";
import type { CommodityVo } from "@/types/commodity";

const PAGE_SIZE = 18;

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

type HomeLocationState = {
  commodityKind?: CommodityKindValue;
  listKind?: CommodityKindValue;
};

function resolveKindFromLocation(state: HomeLocationState | null | undefined): CommodityKindValue | null {
  const k = state?.commodityKind ?? state?.listKind;
  if (k && COMMODITY_KIND_TABS.some((t) => t.value === k)) return k;
  return null;
}

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const dialog = useDialog();
  const [items, setItems] = useState<CommodityVo[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [lastPageLoaded, setLastPageLoaded] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quickManage, setQuickManage] = useState<CommodityVo | null>(null);
  const [processUploadOpen, setProcessUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [commodityStatus, setCommodityStatus] = useState<"" | "UPPER" | "DOWN">("");
  const [commodityKind, setCommodityKind] = useState<CommodityKindValue>(
    () => resolveKindFromLocation(location.state as HomeLocationState | null) ?? COMMODITY_TYPE_OPERATOR,
  );

  const loadMoreLock = useRef(false);
  /** 列表请求世代：Tab/筛选变更时递增，丢弃过期的 fetch 结果 */
  const listEpochRef = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);

  const bumpListEpoch = () => {
    listAbortRef.current?.abort();
    listEpochRef.current += 1;
    return listEpochRef.current;
  };

  /** 仅从详情页带 state 返回时恢复 Tab；消费后清掉 state，避免点其他 Tab 被拉回流程 */
  useEffect(() => {
    const next = resolveKindFromLocation(location.state as HomeLocationState | null);
    if (!next) return;
    bumpListEpoch();
    setItems([]);
    setLastPageLoaded(0);
    setHasMore(true);
    setInitialLoading(true);
    setError(null);
    loadMoreLock.current = false;
    setCommodityKind(next);
    navigate(".", { replace: true, state: {} });
  }, [location.key, navigate]);

  const filterByKind = (rows: CommodityVo[], kind: CommodityKindValue) =>
    rows.filter((c) => {
      const t = (c.commodityType ?? "").trim().toUpperCase();
      return !t || t === kind;
    });

  const reloadFromStart = useCallback(async () => {
    const epoch = bumpListEpoch();
    const kind = commodityKind;
    const ac = new AbortController();
    listAbortRef.current = ac;

    setInitialLoading(true);
    setError(null);
    setItems([]);
    setLastPageLoaded(0);
    setHasMore(true);
    loadMoreLock.current = false;
    try {
      const data = await fetchCommodityList({
        pageNumber: 1,
        pageSize: PAGE_SIZE,
        name,
        commodityStatus,
        type: kind,
        signal: ac.signal,
      });
      if (epoch !== listEpochRef.current) return;
      const content = filterByKind(data.content, kind);
      setItems(content);
      setTotalElements(data.totalElements);
      setLastPageLoaded(1);
      setHasMore(!data.last && content.length > 0);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (epoch !== listEpochRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
      setHasMore(false);
    } finally {
      if (epoch === listEpochRef.current) {
        setInitialLoading(false);
      }
    }
  }, [name, commodityStatus, commodityKind]);

  useEffect(() => {
    void reloadFromStart();
  }, [reloadFromStart]);

  useEffect(
    () => () => {
      listAbortRef.current?.abort();
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || initialLoading || loadingMore || loadMoreLock.current) return;
    if (lastPageLoaded < 1) return;
    const next = lastPageLoaded + 1;
    const epoch = listEpochRef.current;
    const kind = commodityKind;
    const ac = new AbortController();

    loadMoreLock.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchCommodityList({
        pageNumber: next,
        pageSize: PAGE_SIZE,
        name,
        commodityStatus,
        type: kind,
        signal: ac.signal,
      });
      if (epoch !== listEpochRef.current) return;
      const page = filterByKind(data.content, kind);
      setItems((prev) => [...prev, ...page]);
      setLastPageLoaded(next);
      setHasMore(!data.last && page.length > 0);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (epoch !== listEpochRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (epoch === listEpochRef.current) {
        setLoadingMore(false);
        loadMoreLock.current = false;
      }
    }
  }, [
    hasMore,
    initialLoading,
    loadingMore,
    lastPageLoaded,
    name,
    commodityStatus,
    commodityKind,
  ]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { root: null, rootMargin: "240px", threshold: 0 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const applySearch = () => {
    const next = nameDraft.trim();
    // 关键词未变化时也要刷新，否则“点击搜索没反应”
    if (next === name) {
      void reloadFromStart();
      return;
    }
    setName(next);
  };

  const kindMeta = COMMODITY_KIND_TABS.find((t) => t.value === commodityKind);
  const isProcessTab = commodityKind === COMMODITY_TYPE_PROCESS;

  const handleDeleteCommodity = async (commodity: CommodityVo) => {
    if (deletingId) return;
    const ok = await dialog.confirm({
      title: "确认删除商品？",
      message: `确认删除商品「${commodity.alias?.trim() || commodity.name || commodity.id}」吗？\n将删除版本记录与 OSS 文件。`,
      confirmText: "删除",
      cancelText: "取消",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(commodity.id);
    setError(null);
    try {
      const r = await deleteCommodity(commodity.id, true);
      await dialog.alert({
        title: "删除完成",
        message: `商品：${r.commodityName || commodity.name}\n版本数：${r.deletedVersionCount}\nOSS 删除成功：${r.ossDeletedCount}\nOSS 删除失败：${r.ossDeleteFailedCount}`,
        okText: "知道了",
        tone: "success",
      });
      await reloadFromStart();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* 顶部搜索（参考商城样式） */}
      <div className="mx-auto max-w-2xl">
        <div className="relative">
          <input
            type="search"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder="请输入名称"
            className="w-full rounded-full border border-slate-200 bg-white py-3 pl-5 pr-12 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          <button
            type="button"
            onClick={applySearch}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-teal-600"
            aria-label="搜索"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 分类 + 筛选 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="inline-flex flex-wrap rounded-full border border-slate-200 bg-slate-50/80 p-1"
          role="tablist"
          aria-label="商品类型"
        >
          {COMMODITY_KIND_TABS.map((tab) => {
            const active = commodityKind === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (commodityKind === tab.value) return;
                  bumpListEpoch();
                  setItems([]);
                  setLastPageLoaded(0);
                  setHasMore(true);
                  setInitialLoading(true);
                  setError(null);
                  loadMoreLock.current = false;
                  setCommodityKind(tab.value);
                }}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/80"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isProcessTab && (
            <button
              type="button"
              onClick={() => setProcessUploadOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              导入流程
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">上架状态</span>
            <select
              value={commodityStatus}
              onChange={(e) => setCommodityStatus(e.target.value as "" | "UPPER" | "DOWN")}
              className={selectCls}
            >
              <option value="">全部</option>
              <option value="UPPER">UPPER</option>
              <option value="DOWN">DOWN</option>
            </select>
          </label>
          {!initialLoading && (
            <span className="text-xs text-slate-400">
              {kindMeta?.label} · 共 {totalElements} 条
              {items.length > 0 && items.length < totalElements ? ` · 已加载 ${items.length}` : null}
            </span>
          )}
        </div>
      </div>

      {error && (
        <ErrorBanner message={error} onClose={() => setError(null)} />
      )}

      {initialLoading && (
        <div className="py-20 text-center text-sm text-slate-400">加载中…</div>
      )}

      {!initialLoading && !error && items.length === 0 && !isProcessTab && (
        <div className="py-20 text-center text-sm text-slate-400">暂无数据</div>
      )}

      {processUploadOpen && (
        <ProcessUploadModal
          open={processUploadOpen}
          onClose={() => setProcessUploadOpen(false)}
          onUploaded={() => reloadFromStart()}
        />
      )}

      {quickManage && (
        <CommodityQuickManageModal
          commodity={quickManage}
          onClose={() => setQuickManage(null)}
          onApplied={() => void reloadFromStart()}
        />
      )}

      {!initialLoading && isProcessTab && (
        <div>
          {items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
              暂无流程，点击「导入流程」上传 .flow 文件
            </div>
          ) : (
            <ProcessCommodityTable
              items={items}
              deletingId={deletingId}
              onDelete={handleDeleteCommodity}
              onQuickManage={(row) => setQuickManage(row)}
            />
          )}
          <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
          <div className="py-6 text-center text-xs text-slate-400">
            {loadingMore && "加载更多…"}
            {!hasMore && !loadingMore && items.length > 0 && "已加载全部"}
            {hasMore && !loadingMore && items.length > 0 && "向下滚动加载更多"}
          </div>
        </div>
      )}

      {!initialLoading && !isProcessTab && items.length > 0 && (
        <div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((c) => (
              <CommodityCard
                key={c.id}
                commodity={c}
                listKind={commodityKind}
                deleting={deletingId === c.id}
                onDelete={handleDeleteCommodity}
                onQuickManage={(row) => setQuickManage(row)}
              />
            ))}
          </div>
          <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
          <div className="py-6 text-center text-xs text-slate-400">
            {loadingMore && "加载更多…"}
            {!hasMore && !loadingMore && items.length > 0 && "已加载全部"}
            {hasMore && !loadingMore && items.length > 0 && "向下滚动加载更多"}
          </div>
        </div>
      )}
    </div>
  );
}
