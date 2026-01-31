"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eraser, Check, Download } from "lucide-react";

interface ESignaturePadProps {
  documentUrl?: string;
  onSigned?: (signedBlob: Blob) => void;
  onSignatureData?: (dataUrl: string) => void;
}

export function ESignaturePad({
  documentUrl,
  onSigned,
  onSignatureData,
}: ESignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [loading, setLoading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
  };

  const handleEnd = () => {
    setIsEmpty(sigRef.current?.isEmpty() ?? true);
  };

  const getSignatureDataUrl = (): string | null => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Please sign first");
      return null;
    }
    return sigRef.current.toDataURL("image/png");
  };

  const applySignatureToPDF = async () => {
    if (!documentUrl) {
      toast.error("No document provided");
      return;
    }

    const signatureDataUrl = getSignatureDataUrl();
    if (!signatureDataUrl) return;

    setLoading(true);

    try {
      // Fetch the PDF
      const pdfBytes = await fetch(documentUrl).then((r) => r.arrayBuffer());
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Get the first page
      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();

      // Embed the signature image
      const pngImageBytes = await fetch(signatureDataUrl).then((r) =>
        r.arrayBuffer()
      );
      const pngImage = await pdfDoc.embedPng(pngImageBytes);

      // Draw signature at bottom right
      const signatureWidth = 200;
      const signatureHeight = 80;
      page.drawImage(pngImage, {
        x: width - signatureWidth - 50,
        y: 50,
        width: signatureWidth,
        height: signatureHeight,
      });

      // Add signature date
      const { rgb } = await import("pdf-lib");
      page.drawText(`Signed: ${new Date().toLocaleDateString()}`, {
        x: width - signatureWidth - 50,
        y: 35,
        size: 10,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Save the signed PDF
      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(signedPdfBytes)], { type: "application/pdf" });

      if (onSigned) {
        onSigned(blob);
      }

      toast.success("Document signed successfully!");
    } catch (err) {
      console.error("Signature application failed:", err);
      toast.error("Failed to apply signature to document");
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureOnly = () => {
    const signatureDataUrl = getSignatureDataUrl();
    if (signatureDataUrl && onSignatureData) {
      onSignatureData(signatureDataUrl);
      toast.success("Signature captured");
    }
  };

  const downloadSignature = () => {
    const signatureDataUrl = getSignatureDataUrl();
    if (!signatureDataUrl) return;

    const link = document.createElement("a");
    link.download = `signature_${Date.now()}.png`;
    link.href = signatureDataUrl;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-5 w-5 text-blue-600" />
          Electronic Signature
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white">
          <SignatureCanvas
            ref={sigRef}
            penColor="black"
            canvasProps={{
              width: 600,
              height: 200,
              className: "w-full cursor-crosshair",
              style: { touchAction: "none" },
            }}
            onEnd={handleEnd}
          />
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Sign above using your mouse or touch screen
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            onClick={handleClear}
            variant="outline"
            disabled={isEmpty || loading}
          >
            <Eraser className="h-4 w-4 mr-2" />
            Clear
          </Button>

          {documentUrl ? (
            <Button
              onClick={applySignatureToPDF}
              disabled={isEmpty || loading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Sign Document
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleSignatureOnly}
                disabled={isEmpty || loading}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <Check className="h-4 w-4 mr-2" />
                Capture Signature
              </Button>

              <Button
                onClick={downloadSignature}
                variant="outline"
                disabled={isEmpty}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
