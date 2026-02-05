"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  User,
  Trash2,
  Zap,
  Users,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "founder" | "botbuddy";
  content: string;
  action?: {
    type: string;
    dispatched: boolean;
    recipientCount?: number;
    priority: string;
    title: string;
    message: string;
  } | null;
  timestamp: string;
}

function getActionLabel(type: string) {
  switch (type) {
    case "single_user": return "Direct Alert";
    case "child_company": return "Team Blast";
    default: return type;
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent": return "bg-red-500/10 text-red-500 border-red-500/30";
    case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    default: return "bg-blue-500/10 text-blue-500 border-blue-500/30";
  }
}

export default function KidBuddyPage() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if KidBuddy is provisioned for this user
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["kidbuddy-status"],
    queryFn: async () => {
      const { data } = await api.get("/alerts-chamber/kidbuddy/status");
      return data;
    },
  });

  // Load conversation history
  const { data: historyData } = useQuery({
    queryKey: ["kidbuddy-history"],
    queryFn: async () => {
      const { data } = await api.get("/alerts-chamber/kidbuddy/history");
      return data;
    },
    enabled: statusData?.provisioned === true,
  });

  const messages: ChatMessage[] = historyData?.data || [];
  const isProvisioned = statusData?.provisioned === true;
  const companyName = statusData?.companyName || "Your Company";

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post("/alerts-chamber/kidbuddy/message", { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kidbuddy-history"] });
    },
  });

  // Clear history mutation
  const clearHistory = useMutation({
    mutationFn: async () => {
      await api.delete("/alerts-chamber/kidbuddy/history");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kidbuddy-history"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isProvisioned) inputRef.current?.focus();
  }, [isProvisioned]);

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Not provisioned — show locked state
  if (!isProvisioned) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">KidBuddy Not Active</h2>
            <p className="text-muted-foreground mb-4">
              KidBuddy is a premium alert tool for child company owners.
              It lets you communicate with your team through a casual chat interface.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact the platform founder to activate KidBuddy for your company.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Zap className="h-7 w-7 text-green-500" />
            </div>
            KidBuddy
          </h1>
          <p className="text-muted-foreground mt-1">
            Alert your {companyName} team in plain English.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => clearHistory.mutate()}
          disabled={clearHistory.isPending}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Chat
        </Button>
      </div>

      {/* Quick Commands */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: "Help", cmd: "help" },
          { label: "Blast Team", cmd: "tell all team: " },
          { label: "Urgent Alert", cmd: "urgent tell all team: " },
        ].map((q) => (
          <button
            key={q.label}
            onClick={() => {
              setInput(q.cmd);
              inputRef.current?.focus();
            }}
            className="px-3 py-1 rounded-full border text-xs font-medium hover:bg-muted transition-colors"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-green-500/10 flex-shrink-0">
                <Bot className="h-5 w-5 text-green-500" />
              </div>
              <div className="bg-muted rounded-lg rounded-tl-none p-3 max-w-[80%]">
                <p className="font-semibold text-sm text-green-600 mb-1">KidBuddy</p>
                <p className="text-sm">
                  Yo {companyName} boss! I&apos;m KidBuddy, your team alert system.
                  Tell me who on your team needs to hear what. Type <strong>help</strong> for commands.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.role === "founder" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`p-2 rounded-full flex-shrink-0 ${
                  msg.role === "founder" ? "bg-blue-500/10" : "bg-green-500/10"
                }`}
              >
                {msg.role === "founder" ? (
                  <User className="h-5 w-5 text-blue-500" />
                ) : (
                  <Bot className="h-5 w-5 text-green-500" />
                )}
              </div>
              <div
                className={`rounded-lg p-3 max-w-[80%] ${
                  msg.role === "founder"
                    ? "bg-blue-500/10 rounded-tr-none"
                    : "bg-muted rounded-tl-none"
                }`}
              >
                <p className="font-semibold text-xs mb-1 text-muted-foreground">
                  {msg.role === "founder" ? "You" : "KidBuddy"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {msg.action && msg.action.dispatched && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {getActionLabel(msg.action.type)}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(msg.action.priority)}`}>
                      {msg.action.priority}
                    </Badge>
                    {msg.action.recipientCount !== undefined && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1 bg-green-500/10 text-green-500 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        {msg.action.recipientCount} notified
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sendMessage.isPending && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-green-500/10 flex-shrink-0">
                <Bot className="h-5 w-5 text-green-500" />
              </div>
              <div className="bg-muted rounded-lg rounded-tl-none p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  KidBuddy is thinking...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to KidBuddy... (e.g., 'tell all team: meeting at 3pm')"
              className="flex-1 rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
              disabled={sendMessage.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <code>tell [name]: msg</code> &middot; <code>tell all team: msg</code> &middot;
            Add <code>urgent</code> for high priority
          </p>
        </div>
      </Card>
    </div>
  );
}
