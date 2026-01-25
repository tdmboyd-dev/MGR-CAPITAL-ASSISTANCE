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
  | "memo"
  | "power-of-attorney"
  | "subpoena"
  | "settlement-agreement"
  | "assignment-of-interest"
  | "ach-authorization"
  | "contingency-agreement";

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
  {
    id: "power-of-attorney",
    name: "Power of Attorney",
    description: "Limited POA for surplus recovery",
  },
  {
    id: "subpoena",
    name: "Subpoena",
    description: "Court order to appear or produce documents",
  },
  {
    id: "settlement-agreement",
    name: "Settlement Agreement",
    description: "Settlement and release document",
  },
  {
    id: "assignment-of-interest",
    name: "Assignment of Interest",
    description: "Assigns surplus claim rights for fee collection",
  },
  {
    id: "ach-authorization",
    name: "ACH Authorization",
    description: "Authorize automatic fee collection via bank transfer",
  },
  {
    id: "contingency-agreement",
    name: "Contingency Fee Agreement",
    description: "Service agreement with contingency fee terms",
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

    "power-of-attorney": `
LIMITED POWER OF ATTORNEY

Date: ${date}

KNOW ALL PERSONS BY THESE PRESENTS:

I, _________________________ ("Principal"), hereby appoint _________________________ ("Agent") as my attorney-in-fact.

PURPOSE:
${voiceText}

This Limited Power of Attorney is granted solely for the purpose of recovering surplus funds on my behalf.

POWERS GRANTED:
1. Execute documents necessary for surplus fund recovery
2. Communicate with government agencies and courts
3. Receive and endorse checks payable to the Principal

_________________________
Principal Signature

STATE OF _____________
COUNTY OF ____________

Subscribed and sworn before me this _____ day of ____________, 20___.

_________________________
Notary Public
    `.trim(),

    subpoena: `
SUBPOENA

Date: ${date}

TO: _________________________

YOU ARE HEREBY COMMANDED to appear before the Court on ____________ at _____ o'clock.

PURPOSE:
${voiceText}

DOCUMENTS REQUIRED:
1. _________________________
2. _________________________

FAILURE TO COMPLY may result in contempt of court charges.

_________________________
Clerk of Court / Attorney
    `.trim(),

    "settlement-agreement": `
SETTLEMENT AGREEMENT AND RELEASE

Date: ${date}

PARTIES:
Party A: _________________________
Party B: _________________________

RECITALS:
${voiceText}

TERMS:
1. Settlement Amount: $_____________
2. Payment Terms: _________________
3. Release: Upon payment, parties release all claims.
4. Confidentiality: Terms remain confidential.

_________________________          _________________________
Party A Signature                   Party B Signature
    `.trim(),

    "assignment-of-interest": `
ASSIGNMENT OF INTEREST IN SURPLUS FUNDS

Date: ${date}

ASSIGNOR (Former Property Owner):
Name: _________________________
Address: _________________________
Phone: _________________________
Email: _________________________

ASSIGNEE (Recovery Agent):
MGR Capital Assistance
Address: _________________________

PROPERTY INFORMATION:
Property Address: _________________________
County: _________________________
State: _________________________
Tax Sale/Foreclosure Date: _________________________
Case/Parcel Number: _________________________

ASSIGNMENT:

FOR VALUABLE CONSIDERATION, the receipt and sufficiency of which is hereby acknowledged, the Assignor hereby assigns, transfers, and conveys to the Assignee:

A _____ percent (____%) interest in any and all surplus funds, excess proceeds, overages, or similar funds arising from the tax sale, foreclosure sale, or other judicial or non-judicial sale of the above-referenced property.

${voiceText}

TERMS AND CONDITIONS:

1. SCOPE OF ASSIGNMENT: This assignment applies to all surplus funds currently held or to be held by any court, county, municipality, trustee, or other governmental entity arising from the sale of the Property.

2. AUTHORIZATION: Assignor authorizes Assignee to:
   a) File claims on behalf of Assignor
   b) Communicate with all relevant parties
   c) Execute necessary documents
   d) Receive and process surplus fund disbursements

3. DISBURSEMENT INSTRUCTION: Upon approval of any claim, Assignor INSTRUCTS the disbursing authority to issue:
   - Check #1: ____% payable to MGR Capital Assistance
   - Check #2: ____% payable to Assignor

4. REPRESENTATIONS: Assignor represents that:
   a) Assignor is the rightful owner of the claim
   b) No prior assignment has been made
   c) Assignor has full authority to execute this Assignment
   d) All information provided is accurate

5. IRREVOCABILITY: This Assignment is IRREVOCABLE and shall remain in full force and effect until the surplus funds have been fully distributed.

IN WITNESS WHEREOF, the parties have executed this Assignment as of the date first written above.

_________________________          _________________________
Assignor Signature                  Date

_________________________          _________________________
Assignee Signature                  Date

STATE OF _____________
COUNTY OF ____________

Before me, the undersigned notary public, on this _____ day of ____________, 20___, personally appeared _________________________, known to me (or proved to me on the basis of satisfactory evidence) to be the person whose name is subscribed to the within instrument and acknowledged to me that they executed the same in their authorized capacity.

WITNESS my hand and official seal.

_________________________
Notary Public
My Commission Expires: ____________
    `.trim(),

    "ach-authorization": `
ACH DEBIT AUTHORIZATION FORM

Date: ${date}

MGR CAPITAL ASSISTANCE
ACH AUTHORIZATION FOR AUTOMATIC FEE COLLECTION

ACCOUNT HOLDER INFORMATION:
Name: _________________________
Address: _________________________
City, State, ZIP: _________________________
Phone: _________________________
Email: _________________________

BANK ACCOUNT INFORMATION:
Bank Name: _________________________
Routing Number: _________________________
Account Number: _________________________
Account Type: [ ] Checking  [ ] Savings

AUTHORIZATION:

I, the undersigned Account Holder, hereby authorize MGR Capital Assistance ("Company") to initiate ACH debit entries to my bank account listed above for the collection of fees owed pursuant to our Contingency Fee Agreement.

${voiceText}

TERMS:

1. TIMING: The ACH debit will be initiated only AFTER:
   a) The surplus funds claim has been approved, AND
   b) I have confirmed receipt of the surplus funds disbursement

2. AMOUNT: The debit amount will equal the contingency fee percentage stated in our agreement, calculated based on the total surplus funds recovered.

3. NOTIFICATION: Company will provide at least 48 hours advance notice before initiating any ACH debit.

4. REVOCATION: This authorization may be revoked by providing written notice at least 15 business days prior to the scheduled debit date. Note: Revocation does not eliminate the obligation to pay fees owed.

5. ERRORS: In the event of an erroneous debit, I understand I have the right to dispute the transaction with my bank within 60 days.

6. INSUFFICIENT FUNDS: I agree to maintain sufficient funds in the account for the scheduled debit. I understand that returned payments may result in additional fees.

SIGNATURES:

I certify that I am an authorized signer on the bank account listed above and that all information provided is accurate and complete.

_________________________          _________________________
Account Holder Signature            Date

_________________________
Printed Name

FOR OFFICE USE ONLY:
Authorization ID: _________________________
Case Number: _________________________
Contingency Rate: _____%
Verified By: _________________________
    `.trim(),

    "contingency-agreement": `
CONTINGENCY FEE AGREEMENT
SURPLUS FUNDS RECOVERY SERVICES

Date: ${date}

This Contingency Fee Agreement ("Agreement") is entered into between:

CLIENT (Former Property Owner):
Name: _________________________
Address: _________________________
City, State, ZIP: _________________________
Phone: _________________________
Email: _________________________
SSN (last 4): XXX-XX-____

RECOVERY AGENT:
MGR Capital Assistance ("Agent")
Address: _________________________

PROPERTY INFORMATION:
Property Address: _________________________
County: _________________________  State: _________________________
Sale Date: _________________________
Estimated Surplus Amount: $_________________________

SERVICES:

Agent agrees to provide the following services on behalf of Client:

1. Research and verify surplus funds availability
2. Prepare and file all necessary claim documentation
3. Communicate with courts, counties, and other entities
4. Track claim status and deadlines
5. Facilitate disbursement of recovered funds

${voiceText}

FEE STRUCTURE:

Client agrees to pay Agent a contingency fee calculated as follows:

[ ] Standard Rate: ____% of total surplus funds recovered
[ ] Complex Case Rate: ____% (heir search, multiple claimants, litigation required)

PAYMENT TERMS:

1. NO UPFRONT FEES: Client owes nothing unless surplus funds are successfully recovered.

2. FEE CALCULATION: Upon successful recovery, Agent's fee equals:
   Total Surplus Recovered x Contingency Percentage = Agent Fee

3. DISBURSEMENT METHOD (select one):
   [ ] Court-Directed Split: Court issues separate checks to Client and Agent
   [ ] ACH Authorization: Client authorizes automatic fee deduction (see ACH form)
   [ ] Direct Payment: Client pays Agent within 5 business days of receiving funds

4. EXAMPLE: If $50,000 in surplus is recovered at a 33% contingency rate:
   - Agent Fee: $16,500
   - Client Receives: $33,500

REPRESENTATIONS AND WARRANTIES:

Client represents and warrants that:
a) Client is the rightful claimant to the surplus funds
b) Client has not engaged another agent for this same claim
c) All information provided is true and accurate
d) Client has full legal capacity to enter this Agreement

TERM AND TERMINATION:

This Agreement remains in effect until:
a) Surplus funds are successfully recovered and fees paid, OR
b) Either party provides 30 days written notice of termination, OR
c) Agent determines the claim is not viable (no fee owed)

If Client terminates after Agent has filed a claim, Client remains obligated to pay the agreed fee from any funds ultimately recovered.

ENTIRE AGREEMENT:

This Agreement constitutes the entire understanding between the parties and supersedes all prior agreements. Any modifications must be in writing and signed by both parties.

SIGNATURES:

By signing below, the parties agree to be bound by the terms of this Agreement.

_________________________          _________________________
Client Signature                    Date

_________________________
Printed Name

_________________________          _________________________
Agent Signature                     Date

_________________________
Printed Name / Title
    `.trim(),
  };

  return templates[type] || templates["demand-letter"];
}
