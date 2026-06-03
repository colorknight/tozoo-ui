import { useCallback, useEffect, useState } from "react";
import {
  deletePromotion,
  fetchPromotionPage,
  savePromotion,
  type PromotionManageVo,
} from "@/api/promotionManage";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useDialog } from "@/components/DialogProvider";

const tableCls = "min-w-full divide-y divide-slate-200 text-sm";
const thCls = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500";
const tdCls = "px-3 py-2 text-slate-700";
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

function formatDt(s?: string): string {
  if (!s) return "—";
  return s.replace("T", " ").slice(0, 19);
}

/** `datetime-local` 值 -> `yyyy-MM-dd HH:mm:ss`（与后端 Jackson 约定） */
function localToBackend(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseCouponIds(text: string): string[] {
  return text
    .split(/[\s,，;；]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PromotionManagePage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<PromotionManageVo[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionManageVo | null>(null);
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [couponIdsText, setCouponIdsText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPromotionPage(pageNumber, 20);
      setRows(data.content);
      setTotalPages(data.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [pageNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setAlias("");
    setRangeStart("");
    setRangeEnd("");
    setCouponIdsText("");
    setOpen(true);
  };

  const openEdit = (r: PromotionManageVo) => {
    setEditing(r);
    setName(r.name ?? "");
    setAlias(r.alias ?? "");
    setCouponIdsText((r.couponIds ?? []).join(", "));
    if (r.rangeStart) {
      const d = new Date(r.rangeStart);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        setRangeStart(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
        );
      } else setRangeStart("");
    } else setRangeStart("");
    if (r.rangeEnd) {
      const d = new Date(r.rangeEnd);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        setRangeEnd(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
        );
      } else setRangeEnd("");
    } else setRangeEnd("");
    setOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("请填写活动名称");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const rs = localToBackend(rangeStart);
      const re = localToBackend(rangeEnd);
      await savePromotion({
        id: editing?.id,
        name: name.trim(),
        alias: alias.trim() || undefined,
        couponIds: parseCouponIds(couponIdsText),
        rangeStart: rs,
        rangeEnd: re,
      });
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    const ok = await dialog.confirm({
      title: "确认删除活动？",
      message: "确定删除该活动？",
      confirmText: "删除",
      cancelText: "取消",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      await deletePromotion(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">营销活动</h2>
          <p className="text-sm text-slate-500">配置时间段与绑定的消费券（券请在「消费券」中先创建）。</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
        >
          新建活动
        </button>
      </div>

      {error && (
        <ErrorBanner message={error} onClose={() => setError(null)} className="rounded-lg px-3 py-2" />
      )}

      <div className="overflow-x-auto rounded-xl border border-admin-border bg-white shadow-sm">
        <table className={tableCls}>
          <thead className="bg-slate-50">
            <tr>
              <th className={thCls}>名称</th>
              <th className={thCls}>时间段</th>
              <th className={thCls}>券数量</th>
              <th className={thCls}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  加载中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className={tdCls}>
                    <div className="font-medium text-slate-800">{r.name || "—"}</div>
                    {r.alias ? <div className="text-xs text-slate-500">{r.alias}</div> : null}
                  </td>
                  <td className={`${tdCls} whitespace-nowrap text-xs`}>
                    {formatDt(r.rangeStart)} ~ {formatDt(r.rangeEnd)}
                  </td>
                  <td className={tdCls}>{r.couponCount}</td>
                  <td className={`${tdCls} space-x-2 whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="text-teal-600 hover:underline"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(r.id)}
                      className="text-red-600 hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
          >
            上一页
          </button>
          <span>
            第 {pageNumber} / {Math.max(totalPages, 1)} 页
          </span>
          <button
            type="button"
            disabled={pageNumber >= totalPages}
            onClick={() => setPageNumber((p) => p + 1)}
            className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800">{editing ? "编辑活动" : "新建活动"}</h3>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">名称</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">别名</span>
              <input className={inputCls} value={alias} onChange={(e) => setAlias(e.target.value)} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-600">开始</span>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">结束</span>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </label>
            </div>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">绑定券 ID（逗号分隔）</span>
              <textarea
                className={`${inputCls} min-h-[72px]`}
                value={couponIdsText}
                onChange={(e) => setCouponIdsText(e.target.value)}
                placeholder="先创建消费券后，将 ID 粘贴于此"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
