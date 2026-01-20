// ============================================
// CLIENT ONBOARDING PAGE — MGR CAPITAL ASSISTANCE
// New client onboarding with real data
// ============================================

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ClientLayout from "../components/layout/ClientLayout";
import { API_BASE_URL } from "../lib/api";

interface ClientInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

interface CaseInfo {
  propertyAddress: string;
  county: string;
  state: string;
}

export default function ClientOnboarding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [uploadingId, setUploadingId] = useState(false);
  const [idUploaded, setIdUploaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) {
      fetchClientData();
    }
  }, [token]);

  async function fetchClientData() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/clients/portal/${token}`);
      const data = await response.json();

      if (data.success) {
        setClientInfo(data.data);
        setCaseInfo(data.case);
        setFormData({
          name: data.data.name || "",
          email: data.data.email || "",
          phone: data.data.phone || "",
          address: data.data.address || "",
          city: data.data.city || "",
          state: data.data.state || "",
          zipCode: data.data.zipCode || "",
        });
        setIdUploaded(data.data.idUploaded || false);
      } else {
        setError(data.error || "Unable to load your information");
      }
    } catch (err) {
      setError("Unable to connect. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveInfo() {
    if (!token) return;

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/clients/portal/${token}/info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setStep(2);
      } else {
        setError(data.error || "Failed to save. Please try again.");
      }
    } catch (err) {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleIdUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    setUploadingId(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch(`${API_BASE_URL}/clients/portal/${token}/id-upload`, {
        method: "POST",
        body: formDataUpload,
      });

      const data = await response.json();

      if (data.success) {
        setIdUploaded(true);
        setStep(3);
      } else {
        setError(data.error || "Upload failed. Please try again.");
      }
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploadingId(false);
    }
  }

  function goToPortal() {
    navigate(`/client/${token}`);
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

  if (error && !clientInfo) {
    return (
      <ClientLayout>
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Unable to Load</h1>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button
            onClick={fetchClientData}
            className="px-4 py-2 bg-slate-900 text-white rounded text-sm"
          >
            Try Again
          </button>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <h1 className="text-xl font-semibold mb-3">Welcome to MGR Capital Assistance</h1>
      <p className="text-sm text-slate-500 mb-6">
        We're here to help you recover funds from the sale of your property
        {caseInfo && (
          <>
            {" "}
            at <span className="font-medium text-slate-700">{caseInfo.propertyAddress}</span>
          </>
        )}
        . There's no upfront cost — we only receive a fee if your case is successfully completed.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-emerald-600 text-white"
                  : s < step
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
            {s < 3 && <div className="w-8 h-0.5 bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Confirm Information */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-semibold mb-4">Step 1 — Confirm Your Information</h2>
          <p className="text-sm text-slate-500 mb-4">
            Please review and confirm your contact details.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveInfo}
              disabled={saving}
              className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Upload ID */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-semibold mb-4">Step 2 — Upload Your ID</h2>
          <p className="text-sm text-slate-500 mb-4">
            A clear photo of your government-issued ID helps us verify we're working with the right
            person. This is required for security and compliance.
          </p>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            {idUploaded ? (
              <div className="text-emerald-600">
                <p className="font-medium">ID Uploaded Successfully</p>
                <p className="text-sm text-slate-500 mt-1">Your ID is being verified.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4">
                  Accepted formats: JPG, PNG, PDF (max 10MB)
                </p>
                <label className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium cursor-pointer inline-block hover:bg-slate-800">
                  {uploadingId ? "Uploading..." : "Select File"}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleIdUpload}
                    disabled={uploadingId}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-slate-600 text-sm hover:text-slate-900"
            >
              ← Back
            </button>
            {idUploaded && (
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-emerald-600">✓</span>
          </div>
          <h2 className="font-semibold text-xl mb-2">You're All Set!</h2>
          <p className="text-sm text-slate-500 mb-6">
            We've received your information. When your documents are ready, you'll be able to
            review and sign them in your portal. We'll send you an email notification.
          </p>

          <button
            onClick={goToPortal}
            className="px-6 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-500"
          >
            Go to My Portal
          </button>
        </div>
      )}
    </ClientLayout>
  );
}
