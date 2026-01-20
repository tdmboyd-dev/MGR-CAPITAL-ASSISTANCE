// ============================================
// ADMIN INGESTION PAGE — MGR CAPITAL ASSISTANCE
// Data import and case ingestion for FOUNDER
// ============================================

import { useState, useEffect } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";

interface IngestionBatch {
  id: string;
  sourceType: string;
  sourceFile: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  createdAt: string;
  completedAt: string | null;
}

interface IngestionPreview {
  records: Array<{
    ownerName: string;
    propertyAddress: string;
    state: string;
    county: string;
    surplusAmountCents: number;
    saleDate: string;
  }>;
  totalCount: number;
  validCount: number;
  invalidCount: number;
}

export default function AdminIngestion() {
  const [batches, setBatches] = useState<IngestionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<IngestionPreview | null>(null);

  useEffect(() => {
    fetchBatches();
  }, []);

  async function fetchBatches() {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<any>("/ingestion/batches");
      if (response.data.success) {
        setBatches(response.data.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load ingestion history");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload() {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("http://localhost:4000/api/ingestion/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setPreview(data.preview);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function processIngestion() {
    if (!preview) return;

    try {
      const response = await api.post<any>("/ingestion/process", {
        records: preview.records,
      });

      if (response.data.success) {
        setPreview(null);
        setSelectedFile(null);
        fetchBatches();
      } else {
        setError(response.data.error || "Processing failed");
      }
    } catch (err: any) {
      setError(err.message || "Processing failed");
    }
  }

  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(cents / 100);
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Data Ingestion</h1>
        <button
          onClick={fetchBatches}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Import New Data</h2>
        <p className="text-sm text-slate-400 mb-4">
          Upload CSV files containing tax sale surplus data. Supported formats: Tax Sale Lists, Surplus PDFs (converted).
        </p>

        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white"
          />
          <button
            onClick={handleFileUpload}
            disabled={!selectedFile || uploading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded text-sm font-medium"
          >
            {uploading ? "Uploading..." : "Upload & Preview"}
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          <p>Expected CSV columns: owner_name, property_address, city, state, county, surplus_amount, sale_date, parcel_number</p>
        </div>
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="bg-slate-900 border border-emerald-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-emerald-400">Import Preview</h2>
            <div className="flex gap-4">
              <span className="text-sm text-slate-400">
                Total: {preview.totalCount} | Valid: {preview.validCount} | Invalid: {preview.invalidCount}
              </span>
              <button
                onClick={() => {
                  setPreview(null);
                  setSelectedFile(null);
                }}
                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={processIngestion}
                disabled={preview.validCount === 0}
                className="px-4 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 rounded"
              >
                Import {preview.validCount} Records
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="px-4 py-2 font-medium">Owner Name</th>
                  <th className="px-4 py-2 font-medium">Property</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium text-right">Surplus</th>
                  <th className="px-4 py-2 font-medium">Sale Date</th>
                </tr>
              </thead>
              <tbody>
                {preview.records.slice(0, 10).map((record, idx) => (
                  <tr key={idx} className="border-b border-slate-800">
                    <td className="px-4 py-2">{record.ownerName}</td>
                    <td className="px-4 py-2 text-slate-300">{record.propertyAddress}</td>
                    <td className="px-4 py-2">{record.county}, {record.state}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-400">
                      {formatCurrency(record.surplusAmountCents)}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{record.saleDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.records.length > 10 && (
              <p className="text-center text-sm text-slate-400 py-2">
                ...and {preview.records.length - 10} more records
              </p>
            )}
          </div>
        </div>
      )}

      {/* Ingestion History */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
          <h2 className="font-semibold">Ingestion History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Processed</th>
                <th className="px-4 py-3 font-medium text-right">Failed</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No ingestion history. Upload your first data file to get started.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(batch.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{batch.sourceType}</p>
                        <p className="text-xs text-slate-400 truncate max-w-xs">
                          {batch.sourceFile}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          batch.status === "COMPLETED"
                            ? "bg-emerald-900/50 text-emerald-400"
                            : batch.status === "PROCESSING"
                            ? "bg-blue-900/50 text-blue-400"
                            : batch.status === "FAILED"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{batch.totalRecords}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">
                      {batch.processedRecords}
                    </td>
                    <td className="px-4 py-3 text-right text-red-400">
                      {batch.failedRecords}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
