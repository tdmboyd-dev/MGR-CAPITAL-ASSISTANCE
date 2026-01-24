"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mic,
  MicOff,
  FileText,
  Loader2,
  Download,
  Volume2,
  FileCheck,
  Sparkles,
} from "lucide-react";

type DocumentType =
  | "demand-letter"
  | "motion"
  | "affidavit"
  | "contract"
  | "notice"
  | "memo";

interface DocumentTemplate {
  id: DocumentType;
  name: string;
  description: string;
}

const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "demand-letter",
    name: "Demand Letter",
    description: "Formal demand for payment or action",
  },
  {
    id: "motion",
    name: "Motion",
    description: "Court motion filing document",
  },
  {
    id: "affidavit",
    name: "Affidavit",
    description: "Sworn statement of facts",
  },
  {
    id: "contract",
    name: "Contract",
    description: "Legal agreement between parties",
  },
  {
    id: "notice",
    name: "Notice",
    description: "Formal notification document",
  },
  {
    id: "memo",
    name: "Legal Memo",
    description: "Internal legal memorandum",
  },
];

export default function VoiceToDocument() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [generating, setGenerating] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("demand-letter");
  const [isSupported, setIsSupported] = useState(true);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + " " + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      toast.error(`Voice error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      if (listening) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [listening]);

  const startListening = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recognition not available");
      return;
    }

    try {
      recognitionRef.current.start();
      setListening(true);
      setTranscript("");
      setInterimTranscript("");
      setDocumentUrl(null);
      setGeneratedContent(null);
      toast.success("Listening... Dictate your document");
    } catch (error) {
      toast.error("Failed to start voice recognition");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
    setInterimTranscript("");
  };

  const generateDocument = async () => {
    if (!transcript.trim()) {
      toast.error("No dictation to process");
      return;
    }

    setGenerating(true);
    setGeneratedContent(null);
    setDocumentUrl(null);

    try {
      const response = await fetch("/api/documents/generate-from-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceText: transcript.trim(),
          type: documentType,
        }),
      });

      if (!response.ok) {
        throw new Error("Generation failed");
      }

      // Check content type
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/pdf")) {
        // Direct PDF response
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setDocumentUrl(url);
        toast.success("Document generated successfully!");
      } else {
        // JSON response with content preview
        const data = await response.json();
        setGeneratedContent(data.content);
        if (data.pdfUrl) {
          setDocumentUrl(data.pdfUrl);
        }
        toast.success("Document generated!");
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate document");

      // Fallback: generate locally
      const fallbackContent = generateLocalDocument(transcript, documentType);
      setGeneratedContent(fallbackContent);
      toast.info("Generated preview locally (API unavailable)");
    } finally {
      setGenerating(false);
    }
  };

  const downloadAsText = () => {
    if (!generatedContent) return;

    const blob = new Blob([generatedContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentType}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MicOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Voice Not Supported</h3>
          <p className="text-muted-foreground">
            Please use Chrome, Edge, or Safari for voice input.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Voice → Legal Document Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Document Type Selection */}
        <div className="space-y-2">
          <Label>Document Type</Label>
          <Select
            value={documentType}
            onValueChange={(v) => setDocumentType(v as DocumentType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TEMPLATES.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex flex-col">
                    <span>{template.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {template.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Microphone Button */}
        <div className="flex flex-col items-center gap-4 py-4">
          <Button
            size="lg"
            variant={listening ? "destructive" : "default"}
            onClick={listening ? stopListening : startListening}
            className="h-24 w-24 rounded-full shadow-lg"
          >
            {listening ? (
              <MicOff className="h-10 w-10" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            {listening
              ? "Listening... Click to stop"
              : "Click to start dictating"}
          </p>
          {listening && (
            <Badge variant="destructive" className="animate-pulse">
              <Volume2 className="h-3 w-3 mr-1" />
              Recording
            </Badge>
          )}
        </div>

        {/* Live Transcript */}
        {(transcript || interimTranscript) && (
          <div className="space-y-2">
            <Label>Dictation</Label>
            <div className="p-4 bg-muted rounded-lg min-h-[120px] max-h-[200px] overflow-auto">
              <p className="whitespace-pre-wrap">
                {transcript}
                <span className="text-muted-foreground italic">
                  {interimTranscript}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTranscript("");
                  setGeneratedContent(null);
                  setDocumentUrl(null);
                }}
              >
                Clear
              </Button>
              <Button
                onClick={generateDocument}
                disabled={generating || !transcript.trim()}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Document
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Generated Content Preview */}
        {generatedContent && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-green-600" />
                Generated Document Preview
              </Label>
              <Button variant="outline" size="sm" onClick={downloadAsText}>
                <Download className="h-4 w-4 mr-2" />
                Download TXT
              </Button>
            </div>
            <Textarea
              value={generatedContent}
              onChange={(e) => setGeneratedContent(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          </div>
        )}

        {/* PDF Download */}
        {documentUrl && (
          <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <FileText className="h-8 w-8 text-green-600" />
            <div className="flex-1">
              <p className="font-medium">Document Ready</p>
              <p className="text-sm text-muted-foreground">
                Your {DOCUMENT_TEMPLATES.find((t) => t.id === documentType)?.name}{" "}
                is ready for download
              </p>
            </div>
            <a
              href={documentUrl}
              download={`${documentType}-${Date.now()}.pdf`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>
        )}

        {/* Tips */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p className="font-medium">Tips for better results:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Speak clearly and at a moderate pace</li>
            <li>Include names, dates, and amounts when relevant</li>
            <li>Say "new paragraph" to indicate paragraph breaks</li>
            <li>Review and edit the generated document before use</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// Local fallback document generation
function generateLocalDocument(voiceText: string, type: DocumentType): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const templates: Record<DocumentType, string> = {
    "demand-letter": `
DEMAND LETTER

Date: ${date}

RE: Formal Demand

To Whom It May Concern:

${voiceText}

This letter serves as formal demand for immediate action. Please respond within thirty (30) days of receipt of this letter.

Failure to respond or comply may result in further legal action.

Respectfully,

_________________________
[Signature]
    `.trim(),

    motion: `
IN THE COURT OF ____________

CASE NO.: ____________

MOTION

Comes now the undersigned and respectfully moves this Honorable Court as follows:

${voiceText}

WHEREFORE, the undersigned respectfully requests that this Court grant the relief requested herein.

Respectfully submitted,

Date: ${date}

_________________________
[Attorney/Party Name]
    `.trim(),

    affidavit: `
AFFIDAVIT

STATE OF ____________
COUNTY OF ____________

Before me, the undersigned authority, personally appeared ____________, who being duly sworn, deposes and states as follows:

${voiceText}

FURTHER AFFIANT SAYETH NOT.

_________________________
[Affiant Signature]

SWORN TO AND SUBSCRIBED before me this _____ day of ____________, 20___.

_________________________
Notary Public
My Commission Expires: ____________
    `.trim(),

    contract: `
AGREEMENT

This Agreement is entered into as of ${date}.

PARTIES:
[Party 1 Name] ("Party A")
[Party 2 Name] ("Party B")

RECITALS:
${voiceText}

TERMS AND CONDITIONS:

1. The parties agree to the terms set forth herein.
2. This Agreement shall be binding upon the parties and their successors.
3. This Agreement constitutes the entire understanding between the parties.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

_________________________     _________________________
Party A                       Party B
    `.trim(),

    notice: `
NOTICE

Date: ${date}

TO: [Recipient Name/Address]

RE: Formal Notice

Please take notice that:

${voiceText}

This notice is provided in accordance with applicable law and regulations.

Please govern yourself accordingly.

Respectfully,

_________________________
[Name]
[Title]
    `.trim(),

    memo: `
LEGAL MEMORANDUM

TO: [Recipient]
FROM: [Author]
DATE: ${date}
RE: Legal Analysis

QUESTION PRESENTED:

BRIEF ANSWER:

FACTS:
${voiceText}

ANALYSIS:

CONCLUSION:

_________________________
[Attorney Name]
    `.trim(),
  };

  return templates[type] || templates["demand-letter"];
}
