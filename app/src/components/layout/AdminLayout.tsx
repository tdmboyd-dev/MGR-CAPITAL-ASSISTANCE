import { ReactNode } from "react";

type Props = { children: ReactNode };

export default function AdminLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4">
        <div className="mb-8">
          <div className="text-xl font-semibold tracking-wide">
            MGR Capital Assistance
          </div>
          <div className="text-xs text-slate-400 mt-1">Founder / Admin</div>
        </div>
        <nav className="space-y-2 text-sm">
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/admin">
            Dashboard
          </a>
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/admin/cases">
            Cases
          </a>
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/admin/employees">
            Employees
          </a>
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/admin/banking">
            Banking
          </a>
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/admin/settings">
            AI & Settings
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}