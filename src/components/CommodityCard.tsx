import { Link } from "react-router-dom";
import type { CommodityKindValue } from "@/api/commodity";
import type { CommodityVo } from "@/types/commodity";

type Props = {
  commodity: CommodityVo;
  /** 首页当前 Tab，用于详情页返回时恢复列表类型 */
  listKind: CommodityKindValue;
  deleting?: boolean;
  onDelete?: (commodity: CommodityVo) => void;
  onQuickManage?: (commodity: CommodityVo) => void;
};

function statusMeta(status?: string): {
  label: string;
  title: string;
  className: string;
  icon: "onShelf" | "offShelf";
} | null {
  const s = (status || "").trim().toUpperCase();
  if (s === "UPPER") {
    return {
      label: "上架",
      title: "已上架",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: "onShelf",
    };
  }
  if (s === "DOWN") {
    return {
      label: "下架",
      title: "已下架",
      className: "border-slate-200 bg-slate-50 text-slate-600",
      icon: "offShelf",
    };
  }
  return null;
}

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

function PortraitArea({ portrait }: { portrait?: string }) {
  const raw = normalizePortrait(portrait ?? "");
  const iconBox =
    "flex h-20 w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100/90 px-2 py-2";

  if (isSvgMarkup(raw)) {
    return (
      <div
        className={`${iconBox} [&_svg]:max-h-10 [&_svg]:max-w-[2.75rem] [&_svg]:object-contain`}
        dangerouslySetInnerHTML={{ __html: raw }}
      />
    );
  }

  if (looksLikeBase64Only(raw)) {
    return (
      <div className={iconBox}>
        <img
          alt=""
          src={`data:image/svg+xml;base64,${raw.replace(/\s/g, "")}`}
          className="max-h-10 max-w-[2.75rem] object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className={iconBox}>
      <span className="text-[10px] text-slate-300">无图标</span>
    </div>
  );
}

type ToolbarProps = {
  commodity: CommodityVo;
  sm: ReturnType<typeof statusMeta>;
  priceText: string;
  showFree: boolean;
  onQuickManage?: (commodity: CommodityVo) => void;
};

function StatusPriceToolbar({ commodity, sm, priceText, showFree, onQuickManage }: ToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {onQuickManage && sm && (
        <button
          type="button"
          onClick={() => onQuickManage(commodity)}
          className={[
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-teal-500/40",
            sm.icon === "onShelf"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700",
          ].join(" ")}
          title={`${sm.title}，点击查看价格与上下架`}
          aria-label={`${sm.label}，打开管理`}
        >
          {sm.icon === "onShelf" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" d="M4 7h10M4 12h14M4 17h10M16 9l2 2 4-4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" d="M4 7h14M4 12h14M4 17h14M6 6l12 12" />
            </svg>
          )}
        </button>
      )}
      {onQuickManage && !sm && (
        <button
          type="button"
          onClick={() => onQuickManage(commodity)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          title="商品状态，点击查看价格与上下架"
          aria-label="打开管理"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
        </button>
      )}
      {!onQuickManage && sm && (
        <span
          className={[
            "pointer-events-none inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-sm",
            sm.icon === "onShelf"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700",
          ].join(" ")}
          title={sm.title}
          aria-label={sm.label}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" d="M4 7h10M4 12h14M4 17h10M16 9l2 2 4-4" />
          </svg>
        </span>
      )}
      <span
        className={[
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
          showFree ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700",
        ].join(" ")}
      >
        {priceText}
      </span>
    </div>
  );
}

type FooterProps = {
  commodity: CommodityVo;
  listKind: CommodityKindValue;
  deleting: boolean;
  onDelete?: (commodity: CommodityVo) => void;
};

function CardActions({ commodity, listKind, deleting, onDelete }: FooterProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Link
        to={`/product/${encodeURIComponent(commodity.id)}`}
        state={{ commodity, listKind }}
        className="rounded-md bg-teal-500 py-1.5 text-center text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-600"
      >
        详情
      </Link>
      <button
        type="button"
        disabled={deleting}
        onClick={() => onDelete?.(commodity)}
        className="rounded-md border border-red-200 bg-white py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {deleting ? "删除中…" : "删除"}
      </button>
    </div>
  );
}

export function CommodityCard({
  commodity,
  listKind,
  deleting = false,
  onDelete,
  onQuickManage,
}: Props) {
  const title = commodity.alias?.trim() || commodity.name || "未命名";
  const enName = (commodity.name || "").trim();
  const showEnName = !!enName && enName !== title;
  const sm = statusMeta(commodity.commodityStatus);
  const priceNum = commodity.price != null ? Number(commodity.price) : 0;
  const showFree = !Number.isFinite(priceNum) || priceNum <= 0;
  const priceText = showFree
    ? "¥0"
    : `¥${Number.isFinite(priceNum) ? priceNum.toFixed(priceNum % 1 === 0 ? 0 : 2) : ""}`;

  const toolbar = (
    <StatusPriceToolbar
      commodity={commodity}
      sm={sm}
      priceText={priceText}
      showFree={showFree}
      onQuickManage={onQuickManage}
    />
  );

  const actions = (
    <CardActions
      commodity={commodity}
      listKind={listKind}
      deleting={deleting}
      onDelete={onDelete}
    />
  );

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <PortraitArea portrait={commodity.portrait} />

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
        <div className="mb-1 flex items-center justify-end gap-2">{toolbar}</div>
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-slate-800">
          {title}
        </h3>
        <p
          className={[
            "mt-0.5 line-clamp-1 min-h-[1rem] text-xs",
            showEnName ? "text-slate-400" : "select-none text-transparent",
          ].join(" ")}
          aria-hidden={!showEnName}
        >
          {showEnName ? enName : "\u00A0"}
        </p>
        <div className="mt-3">{actions}</div>
      </div>
    </article>
  );
}
