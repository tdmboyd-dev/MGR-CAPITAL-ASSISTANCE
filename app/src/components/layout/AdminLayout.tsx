import { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useLocation, Link } from "react-router-dom";

type Props = { children: ReactNode };

export default function AdminLayout({ children }: Props) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <div className="mb-8">
          <div className="text-xl font-semibold tracking-wide">
            MGR Capital
          </div>
          <div className="text-xs text-slate-400 mt-1">Assistance Platform</div>
        </div>

        <nav className="space-y-1 text-sm flex-1">
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/admin")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/admin"
          >
            Dashboard
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/admin/cases")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/admin/cases"
          >
            Cases
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/admin/employees")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/admin/employees"
          >
            Employees
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/admin/banking")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/admin/banking"
          >
            Banking & Payouts
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/admin/training")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/admin/training"
          >
            Training Modules
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/admin/ingestion")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/admin/ingestion"
          >
            Data Ingestion
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/admin/settings")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/admin/settings"
          >
            Settings
          </Link>
        </nav>

        {/* User Info */}
        <div className="border-t border-slate-800 pt-4 mt-4">
          <div className="px-2 mb-3">
            <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
            <p className="text-xs text-emerald-400">{user?.role || "Unknown"}</p>
          </div>
          <button
            onClick={logout}
            className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-red-900/20 rounded transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}