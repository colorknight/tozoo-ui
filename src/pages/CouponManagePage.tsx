import { useCallback, useEffect, useState } from "react";
import {
  createCoupon,
  deleteCoupon,
  fetchCouponPage,
  type CouponKind,
  type CouponManageVo,
} from "@/api/couponManage";
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

function localToBackend(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const KIND_LABEL: Record<CouponKind, string> = {
  CASH_DISCOUNT: "现金满减",
  OFF_DISCOUNT: "折扣",
  VOUCHER: "单品券",
};

export function CouponManagePage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<CouponManageVo[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CouponKind>("CASH_DISCOUNT");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [couponType, setCouponType] = useState("DISCOUNT");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [off, setOff] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCouponPage(pageNumber, 20);
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
    setKind("CASH_DISCOUNT");
    setName("");
    setAlias("");
    setCouponType("DISCOUNT");
    setStartLocal("");
    setEndLocal("");
    setAmount("");
    setDiscount("");
    setOff("0.85");
    setCommodityId("");
    setOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("请填写名称");
      return;
    }
    const st = localToBackend(startLocal);
    const et = localToBackend(endLocal);
    if (!st || !et) {
      setError("请填写生效开始与结束时间");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        kind,
        name: name.trim(),
        alias: alias.trim() || undefined,
        couponType: couponType.trim() || undefined,
        startTime: st,
        endTime: et,
        amount: amount === "" ? undefined : Number(amount),
        discount: discount === "" ? undefined : Number(discount),
        off: off === "" ? undefined : Number(off),
        commodityId: kind === "VOUCHER" ? commodityId.trim() : undefined,
      };
      await createCoupon(payload);
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
      title: "确认删除消费券？",
      message: "确定删除该券？若活动已引用会先解除引用。",
      confirmText: "删除",
      cancelText: "取消",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteCoupon(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">消费券</h2>
          <p className="text-sm text-slate-500">维护满减、折扣、单品券模板；活动里通过券 ID 绑定。</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
        >
          新建券
        </button>
      </div>

      {error && (
        <ErrorBanner message={error} onClose={() => setError(null)} className="rounded-lg px-3 py-2" />
      )}

      <div className="overflow-x-auto rounded-xl border border-admin-border bg-white shadow-sm">
        <table className={tableCls}>
          <thead className="bg-slate-50">
            <tr>
              <th className={thCls}>类型</th>
              <th className={thCls}>名称</th>
              <th className={thCls}>生效期</th>
              <th className={thCls}>规则</th>
              <th className={thCls}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  加载中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className={tdCls}>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {KIND_LABEL[r.kind as CouponKind] ?? r.kind}
                    </span>
                  </td>
                  <td className={tdCls}>
                    <div className="font-medium text-slate-800">{r.name || "—"}</div>
                    <div className="font-mono text-xs text-slate-400">{r.id}</div>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap text-xs`}>
                    {formatDt(r.startTime)} ~ {formatDt(r.endTime)}
                  </td>
                  <td className={`${tdCls} text-xs`}>
                    {r.kind === "CASH_DISCOUNT" && (
                      <span>
                        门槛 {r.amount ?? "—"} / 减 {r.discount ?? "—"}
                      </span>
                    )}
                    {r.kind === "OFF_DISCOUNT" && (
                      <span>
                        门槛 {r.amount ?? "—"} / 折 {r.off ?? "—"}
                      </span>
                    )}
                    {r.kind === "VOUCHER" && (
                      <span>商品 {r.commodityId ?? "—"} / 额 {r.amount ?? "—"}</span>
                    )}
                    {r.kind !== "CASH_DISCOUNT" &&
                      r.kind !== "OFF_DISCOUNT" &&
                      r.kind !== "VOUCHER" && <span>—</span>}
                  </td>
                  <td className={tdCls}>
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
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800">新建消费券</h3>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">类型</span>
              <select
                className={inputCls}
                value={kind}
                onChange={(e) => setKind(e.target.value as CouponKind)}
              >
                <option value="CASH_DISCOUNT">现金满减</option>
                <option value="OFF_DISCOUNT">折扣</option>
                <option value="VOUCHER">单品券</option>
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">名称</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">别名</span>
              <input className={inputCls} value={alias} onChange={(e) => setAlias(e.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">券分类（couponType）</span>
              <select
                className={inputCls}
                value={couponType}
                onChange={(e) => setCouponType(e.target.value)}
              >
                <option value="DISCOUNT">DISCOUNT（现金类）</option>
                <option value="AWARDS">AWARDS（赠予）</option>
              </select>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-600">生效开始</span>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">生效结束</span>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                />
              </label>
            </div>
            {kind === "CASH_DISCOUNT" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-600">门槛金额</span>
                  <input
                    className={inputCls}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">减免金额</span>
                  <input
                    className={inputCls}
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </label>
              </div>
            )}
            {kind === "OFF_DISCOUNT" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-600">门槛金额</span>
                  <input
                    className={inputCls}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">折扣系数（如 0.8）</span>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.01"
                    value={off}
                    onChange={(e) => setOff(e.target.value)}
                  />
                </label>
              </div>
            )}
            {kind === "VOUCHER" && (
              <div className="mt-3 space-y-3">
                <label className="block text-sm">
                  <span className="text-slate-600">商品 ID</span>
                  <input
                    className={inputCls}
                    value={commodityId}
                    onChange={(e) => setCommodityId(e.target.value)}
                    placeholder="Commodity 主键"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">面额 / 参考金额</span>
                  <input
                    className={inputCls}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              </div>
            )}
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
                {submitting ? "提交中…" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
