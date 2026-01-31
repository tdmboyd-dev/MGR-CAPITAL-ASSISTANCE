"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  PenTool,
  Loader2,
  Shield,
  Clock,
  XCircle,
  User,
  Upload,
  HelpCircle,
  Phone,
  Mail,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PortalData {
  clientName: string;
  propertyAddress: string;
  county: string;
  state: string;
  status: { title: string; description: string };
  steps: { id: string; title: string; description: string; completed: boolean }[];
  currentStep: number;
  documents: { id: string; type: string; needsSignature: boolean; signed: boolean }[];
}

export default function SignPortal() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [signing, setSigning] = useState(false);
  const [signedDocs, setSignedDocs] = useState<Set<string>>(new Set());
  const [allDone, setAllDone] = useState(false);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Contact info form
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Message form
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No portal token provided. Please use the link sent to you.");
      setLoading(false);
      return;
    }
    fetchPortalData();
  }, [token]);

  const fetchPortalData = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/clients/portal/${token}`);
      if (data.success) {
        setPortalData(data.data);
        setContactForm({ name: data.data.clientName || "", phone: "", email: "" });
        setCurrentStep(data.data.currentStep >= 0 ? data.data.currentStep : 0);
        // Mark already-signed docs
        const alreadySigned = new Set<string>();
        data.data.documents.forEach((d: any) => {
          if (d.signed) alreadySigned.add(d.id);
        });
        setSignedDocs(alreadySigned);
      }
    } catch (err: any) {
      if (err.response?.status === 410) {
        setExpired(true);
        setError(err.response.data?.error || "This portal link has expired.");
      } else if (err.response?.status === 404) {
        setError("We couldn't find your case. Please check your link or contact us.");
      } else {
        setError("Something went wrong. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a365d";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const signDocument = async (docId: string) => {
    if (!hasSignature || !canvasRef.current || !token) return;
    setSigning(true);
    try {
      const signatureData = canvasRef.current.toDataURL("image/png");
      await axios.post(`${API_URL}/api/clients/portal/${token}/sign/${docId}`, {
        signatureData,
      });
      setSignedDocs((prev) => new Set([...Array.from(prev), docId]));
      setActiveDocId(null);
      clearSignature();

      // Check if all docs are signed
      const unsignedDocs = portalData?.documents.filter(
        (d) => d.needsSignature && !signedDocs.has(d.id) && d.id !== docId
      );
      if (!unsignedDocs || unsignedDocs.length === 0) {
        setAllDone(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to sign document. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !token) return;
    try {
      await axios.post(`${API_URL}/api/clients/portal/${token}/contact`, {
        message: messageText,
      });
      setMessageSent(true);
      setMessageText("");
    } catch {
      alert("Failed to send message. Please try again.");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading your portal...</p>
        </div>
      </div>
    );
  }

  // Expired state
  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="max-w-lg mx-auto text-center p-8">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <XCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Portal Link Expired</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                Need help? Contact us at{" "}
                <a href="mailto:support@capitalmgr.com" className="font-semibold underline">
                  support@capitalmgr.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !portalData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50">
        <div className="max-w-lg mx-auto text-center p-8">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
            <p className="text-gray-600 mb-6">{error || "Unable to load portal data."}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // All done state
  if (allDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-lg mx-auto text-center p-8"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">All Documents Signed!</h1>
            <p className="text-gray-600 mb-6">
              Thank you, {portalData.clientName}. All your documents have been signed and submitted.
              Our team will handle everything from here.
            </p>
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <p className="text-green-700 font-medium">
                You can check your case status anytime by revisiting this link.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                Questions? Email{" "}
                <a href="mailto:support@capitalmgr.com" className="text-blue-600 underline">
                  support@capitalmgr.com
                </a>{" "}
                or call{" "}
                <a href="tel:1-800-555-0123" className="text-blue-600 underline">
                  1-800-555-0123
                </a>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const steps = portalData.steps;
  const unsignedDocs = portalData.documents.filter(
    (d) => d.needsSignature && !signedDocs.has(d.id)
  );
  const signedDocsList = portalData.documents.filter(
    (d) => d.signed || signedDocs.has(d.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8" />
            <h1 className="text-2xl md:text-3xl font-bold">MGR Capital Assistance</h1>
          </div>
          <p className="text-blue-200 text-lg">Secure Document Signing Portal</p>
          <div className="mt-4 bg-white/10 rounded-lg p-4">
            <p className="font-medium">Welcome, {portalData.clientName}</p>
            <p className="text-blue-200 text-sm mt-1">
              Property: {portalData.propertyAddress}, {portalData.county}, {portalData.state}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Progress</h2>
            <span className="text-sm text-gray-500">
              Step {Math.min(currentStep + 1, steps.length)} of {steps.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
                    step.completed
                      ? "bg-green-500 text-white"
                      : i === currentStep
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded ${
                      step.completed ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <h3 className="font-medium text-gray-900">{steps[Math.min(currentStep, steps.length - 1)]?.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{steps[Math.min(currentStep, steps.length - 1)]?.description}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Case Status */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold">Case Status</h2>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="font-medium text-blue-900">{portalData.status.title}</p>
            <p className="text-blue-700 text-sm mt-1">{portalData.status.description}</p>
          </div>
        </div>

        {/* Documents to Sign */}
        {unsignedDocs.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <PenTool className="h-6 w-6 text-orange-600" />
              <h2 className="text-lg font-semibold">Documents Requiring Your Signature</h2>
              <span className="bg-orange-100 text-orange-700 text-sm px-2 py-1 rounded-full font-medium">
                {unsignedDocs.length} remaining
              </span>
            </div>
            <div className="space-y-4">
              {unsignedDocs.map((doc) => (
                <div key={doc.id}>
                  <div
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      activeDocId === doc.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setActiveDocId(activeDocId === doc.id ? null : doc.id)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.type}</p>
                        <p className="text-sm text-gray-500">Tap to review and sign</p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        activeDocId === doc.id ? "rotate-90" : ""
                      }`}
                    />
                  </div>

                  {/* Signature Area */}
                  <AnimatePresence>
                    {activeDocId === doc.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 p-6 bg-gray-50 rounded-lg border">
                          <h3 className="font-medium text-gray-900 mb-2">Sign Below</h3>
                          <p className="text-sm text-gray-500 mb-4">
                            Draw your signature in the box below. This serves as your legal electronic signature.
                          </p>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white p-1">
                            <canvas
                              ref={canvasRef}
                              width={600}
                              height={180}
                              className="w-full cursor-crosshair touch-none"
                              onMouseDown={startDrawing}
                              onMouseMove={draw}
                              onMouseUp={stopDrawing}
                              onMouseLeave={stopDrawing}
                              onTouchStart={startDrawing}
                              onTouchMove={draw}
                              onTouchEnd={stopDrawing}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <button
                              onClick={clearSignature}
                              className="text-sm text-gray-500 hover:text-gray-700 underline"
                            >
                              Clear Signature
                            </button>
                            <button
                              onClick={() => signDocument(doc.id)}
                              disabled={!hasSignature || signing}
                              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                                hasSignature && !signing
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              {signing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PenTool className="h-4 w-4" />
                              )}
                              {signing ? "Signing..." : "Sign Document"}
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-3">
                            By signing, you agree that this electronic signature has the same legal effect
                            as a handwritten signature.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already Signed Documents */}
        {signedDocsList.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <h2 className="text-lg font-semibold">Signed Documents</h2>
            </div>
            <div className="space-y-3">
              {signedDocsList.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-200"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-green-600" />
                    <p className="font-medium text-green-900">{doc.type}</p>
                  </div>
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Signed
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact / Message Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="h-6 w-6 text-purple-600" />
            <h2 className="text-lg font-semibold">Need Help?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <a href="tel:1-800-555-0123" className="text-blue-600 hover:underline">
                  1-800-555-0123
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <a href="mailto:support@capitalmgr.com" className="text-blue-600 hover:underline">
                  support@capitalmgr.com
                </a>
              </div>
            </div>
            <div>
              {messageSent ? (
                <div className="bg-green-50 rounded-lg p-4 text-green-700">
                  <CheckCircle2 className="h-5 w-5 inline mr-2" />
                  Message sent! We'll get back to you soon.
                </div>
              ) : (
                <div>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your question or message..."
                    className="w-full p-3 border rounded-lg text-sm resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageText.trim()}
                    className={`mt-2 w-full py-2 rounded-lg text-sm font-medium transition ${
                      messageText.trim()
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Send Message
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="text-center text-sm text-gray-400 pb-8">
          <Shield className="h-4 w-4 inline mr-1" />
          Secured by MGR Capital Assistance. Your data is encrypted and protected.
        </div>
      </div>
    </div>
  );
}
