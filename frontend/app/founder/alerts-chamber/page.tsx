"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  User,
  Trash2,
  Zap,
  AlertTriangle,
  Users,
  Building2,
  Globe,
  CheckCircle2,
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

function getActionIcon(type: string) {
  switch (type) {
    case "single_user": return <User className="h-3 w-3" />;
    case "role_blast": return <Users className="h-3 w-3" />;
    case "platform_wide": return <Globe className="h-3 w-3" />;
    case "child_company": return <Building2 className="h-3 w-3" />;
    case "bot_command": return <Bot className="h-3 w-3" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function getActionLabel(type: string) {
  switch (type) {
    case "single_user": return "Direct Alert";
    case "role_blast": return "Role Blast";
    case "platform_wide": return "Platform-Wide";
    case "child_company": return "Child Company";
    case "bot_command": return "Bot Command";
    default: return type;
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent": return "bg-red-500/10 text-red-500 border-red-500/30";
    case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "normal": return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    case "low": return "bg-gray-500/10 text-gray-500 border-gray-500/30";
    default: return "bg-blue-500/10 text-blue-500 border-blue-500/30";
  }
}

export default function AlertsChamberPage() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation history
  const { data: historyData } = useQuery({
    queryKey: ["alerts-chamber-history"],
    queryFn: async () => {
      const { data } = await api.get("/alerts-chamber/history");
      return data;
    },
  });

  const messages: ChatMessage[] = historyData?.data || [];

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post("/alerts-chamber/message", { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts-chamber-history"] });
    },
  });

  // Clear history mutation
  const clearHistory = useMutation({
    mutationFn: async () => {
      await api.delete("/alerts-chamber/history");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts-chamber-history"] });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-7 w-7 text-primary" />
            </div>
            Alerts Chamber
          </h1>
          <p className="text-muted-foreground mt-1">
            Talk to BotBuddy in plain English. He dispatches real alerts across the platform.
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
          { label: "Blast Employees", cmd: "tell all employees: " },
          { label: "Blast Clients", cmd: "tell all clients: " },
          { label: "Platform Alert", cmd: "platform alert: " },
          { label: "Bot Command", cmd: "bot alert: " },
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
          {/* Welcome message if no history */}
          {messages.length === 0 && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="bg-muted rounded-lg rounded-tl-none p-3 max-w-[80%]">
                <p className="font-semibold text-sm text-primary mb-1">BotBuddy</p>
                <p className="text-sm">
                  Yo boss, what&apos;s good? I&apos;m your alert dispatcher. Tell me who needs to hear what and I&apos;ll blast it out.
                  Type <strong>help</strong> if you need the rundown.
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.role === "founder" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`p-2 rounded-full flex-shrink-0 ${
                  msg.role === "founder"
                    ? "bg-blue-500/10"
                    : "bg-primary/10"
                }`}
              >
                {msg.role === "founder" ? (
                  <User className="h-5 w-5 text-blue-500" />
                ) : (
                  <Bot className="h-5 w-5 text-primary" />
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
                  {msg.role === "founder" ? "You" : "BotBuddy"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {/* Action badge */}
                {msg.action && msg.action.dispatched && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      {getActionIcon(msg.action.type)}
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

          {/* Loading indicator */}
          {sendMessage.isPending && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="bg-muted rounded-lg rounded-tl-none p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  BotBuddy is thinking...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to BotBuddy... (e.g., 'tell all employees: meeting at 3pm')"
              className="flex-1 rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={sendMessage.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              size="lg"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Commands: <code>tell [name]: msg</code> &middot; <code>blast employees: msg</code> &middot;{" "}
            <code>platform alert: msg</code> &middot; <code>bot alert: msg</code> &middot;{" "}
            Add <code>urgent</code> for high priority
          </p>
        </div>
      </Card>
    </div>
  );
}
