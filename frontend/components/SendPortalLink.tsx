"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  Link2,
  Mail,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Shield,
  Send,
  Loader2,
  Settings,
  X,
} from "lucide-react";

interface SendPortalLinkProps {
  caseId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  onClose?: () => void;
}

export function SendPortalLink({
  caseId,
  clientName,
  clientEmail,
  clientPhone,
  onClose,
}: SendPortalLinkProps) {
  const [portalUrl, setPortalUrl] = useState<string>("");
  const [signPortalUrl, setSignPortalUrl] = useState<string>("");
  const [copied, setCopied] = useState<"portal" | "sign" | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [keptAlive, setKeptAlive] = useState(false);

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [dissolveAfterDays, setDissolveAfterDays] = useState(12);
  const [keepAlive, setKeepAlive] = useState(false);

  const generateLink = async (action: "copy" | "email" | "sms" = "copy") => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/clients/portal-link/${caseId}`, {
        action,
        email: clientEmail,
        phone: clientPhone,
      });
      if (data.success) {
        setPortalUrl(data.data.portalUrl);
        setSignPortalUrl(data.data.signPortalUrl);
        setExpiresAt(data.data.expiresAt);
        setKeptAlive(data.data.keptAlive);

        if (action === "email" || action === "sms") {
          setSent(true);
          setTimeout(() => setSent(false), 3000);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to generate portal link");
    } finally {
      setLoading(false);
      setSending(false);
    }
  };

  const copyToClipboard = async (url: string, type: "portal" | "sign") => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const updateSettings = async () => {
    try {
      await api.patch(`/clients/portal-settings/${caseId}`, {
        portalKeptAlive: keepAlive,
        portalDissolveAfterDays: dissolveAfterDays,
      });
      setShowSettings(false);
      // Refresh link data
      await generateLink("copy");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update settings");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
            <Link2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Send Portal Link</h3>
            <p className="text-sm text-gray-500">
              {clientName ? `Send to ${clientName}` : "Generate client portal link"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            title="Portal settings"
          >
            <Settings className="h-4 w-4 text-gray-500" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border">
          <h4 className="font-medium text-sm mb-3">Portal Expiration Settings</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-300">
                Auto-dissolve after payment (days)
              </label>
              <input
                type="number"
                value={dissolveAfterDays}
                onChange={(e) => setDissolveAfterDays(Number(e.target.value))}
                className="w-20 px-2 py-1 border rounded text-sm text-center"
                min={1}
                max={365}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-300">
                Keep alive indefinitely
              </label>
              <button
                onClick={() => setKeepAlive(!keepAlive)}
                className={`relative w-10 h-6 rounded-full transition ${
                  keepAlive ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    keepAlive ? "left-5" : "left-1"
                  }`}
                />
              </button>
            </div>
            <button
              onClick={updateSettings}
              className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Generate / Action Buttons */}
      {!portalUrl ? (
        <button
          onClick={() => generateLink("copy")}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Generate Portal Links
        </button>
      ) : (
        <div className="space-y-4">
          {/* Portal Link */}
          <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Client Portal
              </span>
              <button
                onClick={() => copyToClipboard(portalUrl, "portal")}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                {copied === "portal" ? (
                  <>
                    <Check className="h-3 w-3" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <div className="text-xs text-gray-500 bg-white dark:bg-slate-800 p-2 rounded border truncate">
              {portalUrl}
            </div>
          </div>

          {/* Sign Portal Link */}
          <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                Sign Portal (Documents Only)
              </span>
              <button
                onClick={() => copyToClipboard(signPortalUrl, "sign")}
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
              >
                {copied === "sign" ? (
                  <>
                    <Check className="h-3 w-3" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <div className="text-xs text-gray-500 bg-white dark:bg-slate-800 p-2 rounded border truncate">
              {signPortalUrl}
            </div>
          </div>

          {/* Expiration Info */}
          {expiresAt && !keptAlive && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>
                Expires: {new Date(expiresAt).toLocaleDateString()} at{" "}
                {new Date(expiresAt).toLocaleTimeString()}
              </span>
            </div>
          )}
          {keptAlive && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Shield className="h-4 w-4" />
              <span>Portal kept alive indefinitely</span>
            </div>
          )}

          {/* Send Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSending(true);
                generateLink("email");
              }}
              disabled={sending || !clientEmail}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
            >
              {sent ? (
                <>
                  <Check className="h-4 w-4" /> Sent!
                </>
              ) : sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Mail className="h-4 w-4" /> Email Client
                </>
              )}
            </button>
            <button
              onClick={() => {
                setSending(true);
                generateLink("sms");
              }}
              disabled={sending || !clientPhone}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium disabled:opacity-50"
            >
              <MessageSquare className="h-4 w-4" /> SMS Client
            </button>
          </div>

          {/* Open Portal */}
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600 hover:text-blue-700 underline"
          >
            <ExternalLink className="h-4 w-4" /> Preview Portal
          </a>
        </div>
      )}
    </div>
  );
}
