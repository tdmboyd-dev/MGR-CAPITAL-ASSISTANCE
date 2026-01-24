"use client";

/**
 * AiAgentButton.tsx — MGR CAPITAL ASSISTANCE
 * AI Agent action button with modal result display
 * Phase 15: Advanced AI Agents
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  Mail,
  Shield,
  FileText,
  MessageSquare,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

type AgentTask = "outreach" | "compliance" | "summary" | "document_review";

interface AgentContext {
  caseId?: string;
  documentId?: string;
  customData?: Record<string, any>;
}

interface OutreachEmailResult {
  subject: string;
  body: string;
  tone: string;
  callToAction: string;
}

interface ComplianceCheckResult {
  isCompliant: boolean;
  issues: string[];
  recommendations: string[];
  riskLevel: "low" | "medium" | "high";
}

interface AgentResult {
  success: boolean;
  task: AgentTask;
  output: string;
  structuredData?: Record<string, any>;
}

const taskConfig = {
  outreach: {
    icon: Mail,
    label: "Generate Email",
    description: "AI generates personalized outreach email",
    color: "bg-blue-100 text-blue-800",
  },
  compliance: {
    icon: Shield,
    label: "Check Compliance",
    description: "AI reviews case for compliance issues",
    color: "bg-green-100 text-green-800",
  },
  summary: {
    icon: MessageSquare,
    label: "Generate Summary",
    description: "AI summarizes case activity",
    color: "bg-purple-100 text-purple-800",
  },
  document_review: {
    icon: FileText,
    label: "Review Document",
    description: "AI analyzes document content",
    color: "bg-orange-100 text-orange-800",
  },
};

interface AiAgentButtonProps {
  task: AgentTask;
  context: AgentContext;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  onComplete?: (result: AgentResult) => void;
}

export function AiAgentButton({
  task,
  context,
  variant = "outline",
  size = "default",
  className = "",
  onComplete,
}: AiAgentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [followUpInput, setFollowUpInput] = useState("");
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);

  const config = taskConfig[task];
  const Icon = config.icon;

  const executeAgent = async () => {
    setIsLoading(true);
    setResult(null);
    setIsOpen(true);

    try {
      const endpoint =
        task === "outreach"
          ? "/api/ai/agent/outreach"
          : task === "compliance"
          ? "/api/ai/agent/compliance"
          : task === "summary"
          ? "/api/ai/agent/summary"
          : "/api/ai/agent/document-review";

      const body =
        task === "outreach"
          ? { caseId: context.caseId, emailType: "follow_up" }
          : task === "document_review"
          ? { documentId: context.documentId }
          : { caseId: context.caseId };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("Agent request failed");
      }

      const data = await res.json();

      const agentResult: AgentResult = {
        success: data.success,
        task,
        output:
          data.email?.body ||
          data.summary ||
          data.review?.summary ||
          JSON.stringify(data, null, 2),
        structuredData: data.email || data.compliance || data.review,
      };

      setResult(agentResult);
      setConversationHistory(data.conversationHistory || []);
      onComplete?.(agentResult);
    } catch (error) {
      toast.error("AI Agent failed. Please try again.");
      setResult({
        success: false,
        task,
        output: "Failed to execute AI agent. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const sendFollowUp = async () => {
    if (!followUpInput.trim() || conversationHistory.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/agent/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          conversationHistory,
          userMessage: followUpInput,
        }),
      });

      if (!res.ok) throw new Error("Continue failed");

      const data = await res.json();
      setResult({
        success: data.success,
        task,
        output: data.output,
      });
      setConversationHistory(data.conversationHistory || []);
      setFollowUpInput("");
    } catch (error) {
      toast.error("Failed to continue conversation");
    } finally {
      setIsLoading(false);
    }
  };

  const renderOutreachResult = (data: OutreachEmailResult) => (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="font-medium">{data.subject}</p>
          </div>
          <Badge variant="outline">{data.tone}</Badge>
        </div>
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-1">Body</p>
          <p className="whitespace-pre-wrap text-sm">{data.body}</p>
        </div>
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">Call to Action</p>
          <p className="text-sm font-medium text-primary">{data.callToAction}</p>
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => copyToClipboard(`Subject: ${data.subject}\n\n${data.body}`)}
      >
        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
        Copy Email
      </Button>
    </div>
  );

  const renderComplianceResult = (data: ComplianceCheckResult) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge
          className={
            data.isCompliant
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }
        >
          {data.isCompliant ? "Compliant" : "Non-Compliant"}
        </Badge>
        <Badge
          className={
            data.riskLevel === "low"
              ? "bg-green-100 text-green-800"
              : data.riskLevel === "medium"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800"
          }
        >
          {data.riskLevel.toUpperCase()} Risk
        </Badge>
      </div>

      {data.issues.length > 0 && (
        <div className="border rounded-lg p-4 bg-red-50">
          <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Issues Found
          </p>
          <ul className="text-sm text-red-700 space-y-1">
            {data.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recommendations.length > 0 && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <p className="text-sm font-medium text-blue-800 mb-2">Recommendations</p>
          <ul className="text-sm text-blue-700 space-y-1">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    if (!result.success) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{result.output}</p>
        </div>
      );
    }

    if (task === "outreach" && result.structuredData) {
      return renderOutreachResult(result.structuredData as OutreachEmailResult);
    }

    if (task === "compliance" && result.structuredData) {
      return renderComplianceResult(result.structuredData as ComplianceCheckResult);
    }

    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <p className="whitespace-pre-wrap text-sm">{result.output}</p>
      </div>
    );
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={executeAgent}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Icon className="h-4 w-4 mr-2" />
        )}
        {config.label}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Agent: {config.label}
            </DialogTitle>
            <DialogDescription>{config.description}</DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {isLoading && !result ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI is thinking...</span>
                </div>
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              renderResult()
            )}

            {/* Follow-up input */}
            {result?.success && conversationHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Continue the conversation
                </p>
                <div className="flex gap-2">
                  <Textarea
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    placeholder="Ask a follow-up question..."
                    className="min-h-[60px]"
                  />
                  <Button
                    onClick={sendFollowUp}
                    disabled={isLoading || !followUpInput.trim()}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AiAgentButton;
