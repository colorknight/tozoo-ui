import type { CommodityVo } from "@/types/commodity";
import { ProcessCommodityRow } from "@/components/ProcessCommodityRow";

const tableCls = "min-w-full divide-y divide-slate-200 text-sm";
const thCls = "px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500";

type Props = {
  items: CommodityVo[];
  deletingId?: string | null;
  onDelete?: (commodity: CommodityVo) => void;
  onQuickManage?: (commodity: CommodityVo) => void;
};

export function ProcessCommodityTable({ items, deletingId, onDelete, onQuickManage }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className={tableCls}>
        <thead className="bg-slate-50">
          <tr>
            <th className={thCls}>名称</th>
            <th className={thCls}>上架状态</th>
            <th className={thCls}>价格</th>
            <th className={`${thCls} w-[140px]`}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((c) => (
            <ProcessCommodityRow
              key={c.id}
              commodity={c}
              deleting={deletingId === c.id}
              onDelete={onDelete}
              onQuickManage={onQuickManage}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
