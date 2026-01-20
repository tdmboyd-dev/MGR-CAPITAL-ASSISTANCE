import ClientLayout from "../components/layout/ClientLayout";

export default function ClientPortal() {
  // In real build, fetch case by ID from URL
  const mockCase = {
    status: "Documents Needed",
    steps: ["Reviewing", "Documents", "Filed", "Awaiting Funds", "Paid"],
    currentStepIndex: 1,
  };

  return (
    <ClientLayout>
      <h1 className="text-xl font-semibold mb-2">Your Case</h1>
      <p className="text-sm text-slate-500 mb-4">
        We’re helping you complete the steps to access any funds you may be eligible for after the sale of your property.
      </p>

      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          {mockCase.steps.map((step, idx) => (
            <div key={step} className={idx === mockCase.currentStepIndex ? "text-emerald-400" : ""}>
              {step}
            </div>
          ))}
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{
              width: `${((mockCase.currentStepIndex + 1) / mockCase.steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
          <h2 className="font-semibold mb-2">Upload Your ID</h2>
          <p className="text-slate-500 mb-3">
            We need a clear photo of your government-issued ID to verify we’re working with the right person.
          </p>
          <button className="px-3 py-2 rounded bg-slate-900 text-white text-xs font-medium">
            Upload ID
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
          <h2 className="font-semibold mb-2">Sign Your Documents</h2>
          <p className="text-slate-500 mb-3">
            When your documents are ready, you’ll see a button here to review and sign them electronically.
          </p>
          <button className="px-3 py-2 rounded bg-slate-300 text-slate-700 text-xs font-medium" disabled>
            Waiting for documents
          </button>
        </div>
      </div>
    </ClientLayout>
  );
}