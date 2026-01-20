type Employee = {
  name: string;
  rank: string;
  displayedRate: string;
  lifetimeEarnings: string;
  monthEarnings: string;
};

type Props = {
  employee: Employee;
  children: React.ReactNode;
};

export default function EmployeeLayout({ employee, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4">
        <div className="mb-6">
          <div className="text-lg font-semibold">{employee.name}</div>
          <div className="text-xs text-slate-400 mt-1">{employee.rank}</div>
          <div className="text-xs text-emerald-400 mt-1">
            Displayed Commission: {employee.displayedRate}
          </div>
        </div>
        <div className="mb-6 text-xs text-slate-300 space-y-1">
          <div>Lifetime Earnings: {employee.lifetimeEarnings}</div>
          <div>This Month: {employee.monthEarnings}</div>
        </div>
        <nav className="space-y-2 text-sm">
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/office">
            My Cases
          </a>
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/office/training">
            Training
          </a>
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/office/earnings">
            Earnings
          </a>
          <a className="block px-2 py-1 rounded hover:bg-slate-800" href="/office/team">
            My Team
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}