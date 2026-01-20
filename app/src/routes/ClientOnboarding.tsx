import ClientLayout from "../components/layout/ClientLayout";

export default function ClientOnboarding() {
  return (
    <ClientLayout>
      <h1 className="text-xl font-semibold mb-3">Welcome to MGR Capital Assistance</h1>
      <p className="text-sm text-slate-500 mb-4">
        We're here to help you complete the steps to access any funds you may be eligible for after the sale of your property.
        There's no upfront cost — we only receive a fee if your case is successfully completed.
      </p>

      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
          <h2 className="font-semibold mb-1">Step 1 — Confirm Your Information</h2>
          <p className="text-slate-500 mb-2">
            We'll confirm your name, contact details, and the property address connected to your case.
          </p>
          <button className="px-3 py-2 rounded bg-slate-900 text-white text-xs font-medium">
            Review My Info
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
          <h2 className="font-semibold mb-1">Step 2 — Upload Your ID</h2>
          <p className="text-slate-500 mb-2">
            A clear photo of your government-issued ID helps us verify we're working with the right person.
          </p>
          <button className="px-3 py-2 rounded bg-slate-900 text-white text-xs font-medium">
            Upload ID
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
          <h2 className="font-semibold mb-1">Step 3 — Sign Your Documents</h2>
          <p className="text-slate-500 mb-2">
            When your documents are ready, you'll be able to review and sign them electronically in a few taps.
          </p>
          <button className="px-3 py-2 rounded bg-slate-300 text-slate-700 text-xs font-medium" disabled>
            Waiting for documents
          </button>
        </div>
      </div>
    </ClientLayout>
  );
}
