// ============================================
// CLIENT PORTAL PAGE — MGR CAPITAL ASSISTANCE
// Client case view with real data
// ============================================

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import ClientLayout from "../components/layout/ClientLayout";
import { API_BASE_URL } from "../lib/api";

interface CaseData {
  propertyAddress: string;
  county: string;
  state: string;
  status: string;
  statusMessage: string;
  documents: Array<{
    id: string;
    type: string;
    needsSignature: boolean;
    signed: boolean;
  }>;
}

interface ClientInfo {
  name: string;
  email: string;
  phone: string;
}

const STEPS = ["Reviewing", "Documents", "Filed", "Awaiting Funds", "Paid"];

function getStepIndex(status: string): number {
  const statusMap: Record<string, number> = {
    "Getting Started": 0,
    "In Progress": 0,
    "Documents Needed": 1,
    "Processing": 1,
    "Filed": 2,
    "Almost There": 3,
    "Complete": 4,
    "Closed": 4,
    "Under Review": 1,
  };
  return statusMap[status] ?? 0;
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState(false);

  useEffect(() => {
    if (token) {
      fetchCaseData();
    }
  }, [token]);

  async function fetchCaseData() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/cases/client/${token}`);
      const data = await response.json();

      if (data.success) {
        setCaseData(data.data);
      } else {
        setError(data.error || "Unable to load your case");
      }

      // Also fetch client info
      const clientRes = await fetch(`${API_BASE_URL}/clients/portal/${token}`);
      const clientData = await clientRes.json();
      if (clientData.success) {
        setClientInfo(clientData.data);
      }
    } catch (err: any) {
      setError("Unable to connect. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  async function handleIdUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    setUploadingId(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/clients/portal/${token}/id-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        fetchCaseData();
      } else {
        setError(data.error || "Upload failed. Please try again.");
      }
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploadingId(false);
    }
  }

  async function handleSignDocument(documentId: string) {
    if (!token) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/clients/portal/${token}/sign/${documentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signature: "electronic_signature" }),
        }
      );

      const data = await response.json();

      if (data.success) {
        fetchCaseData();
      } else {
        setError(data.error || "Signing failed. Please try again.");
      }
    } catch (err) {
      setError("Signing failed. Please try again.");
    }
  }

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        </div>
      </ClientLayout>
    );
  }

  if (error || !caseData) {
    return (
      <ClientLayout>
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            {error || "Case Not Found"}
          </h1>
          <p className="text-sm text-slate-500 mb-4">
            We couldn't find your case. Please check your link or contact support.
          </p>
          <button
            onClick={fetchCaseData}
            className="px-4 py-2 bg-slate-900 text-white rounded text-sm"
          >
            Try Again
          </button>
        </div>
      </ClientLayout>
    );
  }

  const currentStepIndex = getStepIndex(caseData.status);
  const pendingDocs = caseData.documents?.filter((d) => d.needsSignature && !d.signed) || [];

  return (
    <ClientLayout>
      {/* Welcome */}
      {clientInfo && (
        <p className="text-sm text-slate-600 mb-4">
          Welcome back, {clientInfo.name.split(" ")[0]}
        </p>
      )}

      <h1 className="text-xl font-semibold mb-2">Your Case</h1>
      <p className="text-sm text-slate-500 mb-4">
        We're helping you recover funds from the sale of your property at{" "}
        <span className="font-medium text-slate-700">{caseData.propertyAddress}</span>
      </p>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          {STEPS.map((step, idx) => (
            <div
              key={step}
              className={
                idx === currentStepIndex
                  ? "text-emerald-600 font-medium"
                  : idx < currentStepIndex
                  ? "text-emerald-500"
                  : ""
              }
            >
              {step}
            </div>
          ))}
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{
              width: `${((currentStepIndex + 1) / STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Status Message */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-emerald-800">
          <span className="font-semibold">Status: {caseData.status}</span>
          <br />
          {caseData.statusMessage}
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ID Upload */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
          <h2 className="font-semibold mb-2">Upload Your ID</h2>
          <p className="text-slate-500 mb-3">
            We need a clear photo of your government-issued ID to verify your identity.
          </p>
          <label className="px-3 py-2 rounded bg-slate-900 text-white text-xs font-medium cursor-pointer inline-block">
            {uploadingId ? "Uploading..." : "Upload ID"}
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleIdUpload}
              disabled={uploadingId}
              className="hidden"
            />
          </label>
        </div>

        {/* Document Signing */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm">
          <h2 className="font-semibold mb-2">Sign Your Documents</h2>
          <p className="text-slate-500 mb-3">
            {pendingDocs.length > 0
              ? `You have ${pendingDocs.length} document(s) ready to sign.`
              : "When your documents are ready, you'll see them here."}
          </p>
          {pendingDocs.length > 0 ? (
            <div className="space-y-2">
              {pendingDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSignDocument(doc.id)}
                  className="w-full px-3 py-2 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
                >
                  Sign {doc.type.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          ) : (
            <button
              className="px-3 py-2 rounded bg-slate-300 text-slate-700 text-xs font-medium"
              disabled
            >
              Waiting for documents
            </button>
          )}
        </div>
      </div>

      {/* FAQ Link */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-400">
          Have questions?{" "}
          <Link to={`/client/${token}/faq`} className="text-emerald-600 hover:underline">
            View FAQ
          </Link>{" "}
          or contact us at support@mgrcapital.com
        </p>
      </div>
    </ClientLayout>
  );
}
