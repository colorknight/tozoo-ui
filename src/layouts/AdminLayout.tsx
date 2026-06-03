import { Link, NavLink, Outlet } from "react-router-dom";

const navCls = ({ isActive }: { isActive: boolean }) =>
  [
    "block rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-admin-sidebar-hover font-medium text-white"
      : "text-slate-400 hover:bg-admin-sidebar-hover hover:text-slate-200",
  ].join(" ");

export function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-admin-sidebar text-slate-300">
        <div className="border-b border-slate-700/80 px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-700 text-sm font-bold text-slate-100">
              T
            </span>
            <span className="leading-tight">
              Tozoo
              <span className="block text-xs font-normal text-slate-500">商品管理</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          <NavLink to="/" end className={navCls}>
            商品目录
          </NavLink>
          <NavLink to="/promotions" className={navCls}>
            营销活动
          </NavLink>
          <NavLink to="/coupons" className={navCls}>
            消费券
          </NavLink>
        </nav>
        <div className="border-t border-slate-700/80 p-3 text-xs leading-relaxed text-slate-500">
          价格标签在商品卡上维护；活动与券在此单独管理，需 member-api 已部署对应接口。
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-admin-border bg-admin-surface px-6 py-3">
          <h1 className="text-sm font-medium text-slate-500">算子商品 · 管理端</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
