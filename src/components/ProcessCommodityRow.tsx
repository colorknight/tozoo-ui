import { Link } from "react-router-dom";
import { COMMODITY_TYPE_PROCESS } from "@/api/commodity";
import type { CommodityVo } from "@/types/commodity";

const tdCls = "px-3 py-2.5 text-slate-700";

type Props = {
  commodity: CommodityVo;
  deleting?: boolean;
  onDelete?: (commodity: CommodityVo) => void;
  onQuickManage?: (commodity: CommodityVo) => void;
};

function statusLabel(status?: string): { text: string; className: string } {
  const s = (status || "").trim().toUpperCase();
  if (s === "UPPER") {
    return { text: "上架", className: "text-emerald-700 bg-emerald-50 ring-emerald-200" };
  }
  if (s === "DOWN") {
    return { text: "下架", className: "text-slate-600 bg-slate-50 ring-slate-200" };
  }
  return { text: "—", className: "text-slate-400 bg-slate-50 ring-slate-200" };
}

export function ProcessCommodityRow({
  commodity,
  deleting = false,
  onDelete,
  onQuickManage,
}: Props) {
  const title = commodity.alias?.trim() || commodity.name || "未命名";
  const status = statusLabel(commodity.commodityStatus);

  const priceNum = commodity.price != null ? Number(commodity.price) : 0;
  const showFree = !Number.isFinite(priceNum) || priceNum <= 0;
  const priceText = showFree
    ? "¥0"
    : `¥${Number.isFinite(priceNum) ? priceNum.toFixed(priceNum % 1 === 0 ? 0 : 2) : ""}`;

  return (
    <tr className="hover:bg-slate-50/80">
      <td className={tdCls}>
        <div className="font-medium text-slate-800">{title}</div>
      </td>
      <td className={tdCls}>
        {onQuickManage ? (
          <button
            type="button"
            onClick={() => onQuickManage(commodity)}
            className={[
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors hover:opacity-90",
              status.className,
            ].join(" ")}
            title="点击查看价格与上下架"
          >
            {status.text}
          </button>
        ) : (
          <span
            className={[
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
              status.className,
            ].join(" ")}
          >
            {status.text}
          </span>
        )}
      </td>
      <td className={`${tdCls} tabular-nums font-medium text-slate-800`}>{priceText}</td>
      <td className={`${tdCls} whitespace-nowrap`}>
        <div className="flex items-center gap-2">
          <Link
            to={`/product/${encodeURIComponent(commodity.id)}`}
            state={{ commodity, listKind: COMMODITY_TYPE_PROCESS }}
            className="rounded-md bg-teal-500 px-3 py-1 text-xs font-medium text-white hover:bg-teal-600"
          >
            详情
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => onDelete?.(commodity)}
            className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "删除中…" : "删除"}
          </button>
        </div>
      </td>
    </tr>
  );
}
