import { ReactNode } from "react";

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">MGR Capital Assistance</h1>
          <span className="text-xs text-slate-500">Client Portal</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4">{children}</main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto p-4 text-center text-xs text-slate-400">
        <p>Questions? Contact us at support@mgrcapital.com</p>
        <p className="mt-1">© {new Date().getFullYear()} MGR Capital Assistance</p>
      </footer>
    </div>
  );
}
