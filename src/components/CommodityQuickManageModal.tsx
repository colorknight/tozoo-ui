import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { releaseCommodity } from "@/api/commodity";
import { fetchCommodityVersionsForDetail, type CommodityVersionVo } from "@/api/commodityVersion";
import type { CommodityVo } from "@/types/commodity";

type Props = {
  commodity: CommodityVo;
  onClose: () => void;
  onApplied?: () => void;
};

function formatPrice(c: CommodityVo): string {
  const priceNum = c.price != null ? Number(c.price) : 0;
  const showFree = !Number.isFinite(priceNum) || priceNum <= 0;
  if (showFree) return "¥0";
  return `¥${priceNum.toFixed(priceNum % 1 === 0 ? 0 : 2)}`;
}

export function CommodityQuickManageModal({ commodity, onClose, onApplied }: Props) {
  const [row, setRow] = useState<CommodityVo>(commodity);
  const [versions, setVersions] = useState<CommodityVersionVo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingTarget, setActingTarget] = useState<"" | "UPPER" | "DOWN">("");

  useEffect(() => {
    setRow(commodity);
  }, [commodity]);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchCommodityVersionsForDetail(commodity);
      setVersions(items);
    } catch (e) {
      setVersions([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [commodity]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const enabledNow = versions.filter((v) => v.enabled);
  const enabledSummary =
    enabledNow.length === 0
      ? "暂无"
      : enabledNow
          .map((v) => {
            const fw = v.computionFramework?.trim();
            return fw ? `${v.version}（${fw}）` : v.version;
          })
          .join("；");

  const shelfStatus = (row.commodityStatus || "").trim().toUpperCase();
  const isUpper = shelfStatus === "UPPER";
  const isDown = shelfStatus === "DOWN";

  const doRelease = async (status: "UPPER" | "DOWN") => {
    if (actingTarget) return;
    setActingTarget(status);
    setError(null);
    try {
      const updated = await releaseCommodity(row.id, status);
      setRow((prev) => ({ ...prev, ...updated }));
      onApplied?.();
      setActingTarget("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setActingTarget("");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = row.alias?.trim() || row.name || "商品";
  const statusLabel = isUpper ? "已上架" : isDown ? "已下架" : "状态未返回";

  return createPortal(
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-manage-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-slate-100 px-5 py-4 pr-12">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 id="quick-manage-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            当前商品状态：<span className="font-medium text-slate-700">{statusLabel}</span>
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="text-xs font-medium text-slate-500">价格</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{formatPrice(row)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500">当前启用的版本</div>
            <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {loading ? "加载中…" : enabledSummary}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          {(isDown || (!isUpper && !isDown)) && (
            <button
              type="button"
              disabled={actingTarget !== "" || isUpper}
              onClick={() => void doRelease("UPPER")}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {actingTarget === "UPPER" ? "处理中…" : "上架"}
            </button>
          )}
          {(isUpper || (!isUpper && !isDown)) && (
            <button
              type="button"
              disabled={actingTarget !== "" || isDown}
              onClick={() => void doRelease("DOWN")}
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {actingTarget === "DOWN" ? "处理中…" : "下架"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
