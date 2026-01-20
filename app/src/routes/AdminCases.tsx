import AdminLayout from "../components/layout/AdminLayout";

const mockCases = [
  { id: "C-1029", clientName: "Angela Morris", state: "TN", county: "Shelby", status: "DOCS_PENDING" },
  { id: "C-1030", clientName: "Robert King", state: "GA", county: "Fulton", status: "FILED" },
];

const statusLabel: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  DOCS_PENDING: "Docs Needed",
  DOCS_SIGNED: "Docs Signed",
  FILED: "Filed",
  AWAITING_FUNDS: "Awaiting Funds",
  PAID: "Paid",
};

export default function AdminCases() {
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold mb-4">Cases</h1>
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="text-left px-4 py-2">Case ID</th>
              <th className="text-left px-4 py-2">Client</th>
              <th className="text-left px-4 py-2">State</th>
              <th className="text-left px-4 py-2">County</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockCases.map((c) => (
              <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-850">
                <td className="px-4 py-2">{c.id}</td>
                <td className="px-4 py-2">{c.clientName}</td>
                <td className="px-4 py-2">{c.state}</td>
                <td className="px-4 py-2">{c.county}</td>
                <td className="px-4 py-2 text-slate-300">{statusLabel[c.status] ?? c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
