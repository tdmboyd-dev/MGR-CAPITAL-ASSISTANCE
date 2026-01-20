import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

type Props = {
  children: ReactNode;
};

export default function EmployeeLayout({ children }: Props) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <div className="mb-6">
          <div className="text-lg font-semibold">{user?.name || "Employee"}</div>
          <div className="text-xs text-slate-400 mt-1">{user?.tier || "Associate"}</div>
        </div>

        <nav className="space-y-1 text-sm flex-1">
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/office")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/office"
          >
            My Cases
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/office/training")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/office/training"
          >
            Training
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/office/earnings")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/office/earnings"
          >
            My Earnings
          </Link>
          <Link
            className={`block px-3 py-2 rounded transition-colors ${
              isActive("/office/scripts")
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
            to="/office/scripts"
          >
            Scripts & Tools
          </Link>
        </nav>

        {/* User Info */}
        <div className="border-t border-slate-800 pt-4 mt-4">
          <div className="px-2 mb-3">
            <p className="text-sm font-medium truncate">{user?.name || "Employee"}</p>
            <p className="text-xs text-emerald-400">{user?.role || "EMPLOYEE"}</p>
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
