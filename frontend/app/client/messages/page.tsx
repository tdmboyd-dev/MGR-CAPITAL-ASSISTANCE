"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime, formatDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  DollarSign,
  Bell,
  Loader2,
  Shield,
  Heart,
  User,
  RefreshCw,
  Inbox,
  Plus,
} from "lucide-react";

// Message categories for clients
const MESSAGE_CATEGORIES = {
  case_update: { label: "Case Update", icon: FileText, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  documents: { label: "Documents", icon: FileText, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  payment: { label: "Payment", icon: DollarSign, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  general: { label: "General", icon: MessageSquare, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-800" },
};

interface Message {
  id: string;
  subject: string;
  body: string;
  category?: string;
  isRead: boolean;
  createdAt: string;
  fromName?: string;
  fromType?: "client" | "company";
  caseId?: string;
  case?: {
    propertyAddress?: string;
    county?: string;
    state?: string;
  };
}

export default function ClientMessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [newMessage, setNewMessage] = useState({ subject: "", body: "", caseId: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["client-messages"],
    queryFn: async () => {
      const { data } = await api.get("/messages/my-messages");
      return data;
    },
  });

  // Fetch cases for the new message dropdown
  const { data: casesData } = useQuery({
    queryKey: ["client-cases-for-messages"],
    queryFn: async () => {
      const { data } = await api.get("/cases/my-cases");
      return data;
    },
  });

  // Mark message as read
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await api.post(`/messages/${messageId}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-messages"] });
    },
  });

  // Send new message
  const sendMessageMutation = useMutation({
    mutationFn: async (message: { subject: string; body: string; caseId?: string }) => {
      const { data } = await api.post("/messages", message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-messages"] });
      setShowCompose(false);
      setNewMessage({ subject: "", body: "", caseId: "" });
      toast.success("Message sent successfully!", {
        description: "We'll get back to you as soon as possible.",
      });
    },
    onError: () => {
      toast.error("Failed to send message", {
        description: "Please try again or contact us by phone.",
      });
    },
  });

  // Mark as read when selecting a message
  useEffect(() => {
    if (selectedMessage && !selectedMessage.isRead) {
      markAsReadMutation.mutate(selectedMessage.id);
    }
  }, [selectedMessage?.id]);

  const messages = messagesData?.data || [];
  const cases = casesData?.data || [];
  const unreadCount = messages.filter((m: Message) => !m.isRead).length;

  const getCategoryInfo = (category?: string) => {
    return MESSAGE_CATEGORIES[category as keyof typeof MESSAGE_CATEGORIES] || MESSAGE_CATEGORIES.general;
  };

  const handleSendMessage = () => {
    if (!newMessage.subject.trim() || !newMessage.body.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    sendMessageMutation.mutate(newMessage);
  };

  if (messagesLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">
            Communication history with MGR Capital Assistance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Badge className="bg-blue-500 text-white px-3 py-1">
              {unreadCount} unread
            </Badge>
          )}
          <Button onClick={() => setShowCompose(!showCompose)}>
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>
      </motion.div>

      {/* Quick Contact Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Need a faster response? Call or email us directly:
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="tel:1-800-555-0123"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-800 transition-colors text-sm"
                >
                  <Phone className="h-4 w-4 text-blue-600" />
                  1-800-555-0123
                </a>
                <a
                  href="mailto:support@mgrcapital.com"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-800 transition-colors text-sm"
                >
                  <Mail className="h-4 w-4 text-blue-600" />
                  support@mgrcapital.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Compose New Message */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  New Message
                </CardTitle>
                <CardDescription>
                  Send us a message and we&apos;ll respond as soon as possible
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cases.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Related Case (Optional)
                    </label>
                    <Select
                      value={newMessage.caseId}
                      onValueChange={(value) => setNewMessage({ ...newMessage, caseId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a case if this is about a specific case" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">General Inquiry</SelectItem>
                        {cases.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.propertyAddress || `${c.county}, ${c.state}`} - #{c.caseCode || c.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject</label>
                  <Input
                    placeholder="What is this regarding?"
                    value={newMessage.subject}
                    onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Message</label>
                  <Textarea
                    placeholder="Type your message here..."
                    rows={5}
                    value={newMessage.body}
                    onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowCompose(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Message List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Inbox</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["client-messages"] })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {messages.length > 0 ? (
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {messages.map((message: Message) => {
                    const categoryInfo = getCategoryInfo(message.category);
                    const CategoryIcon = categoryInfo.icon;

                    return (
                      <button
                        key={message.id}
                        onClick={() => setSelectedMessage(message)}
                        className={`w-full text-left px-4 py-4 hover:bg-muted/50 transition-colors ${
                          selectedMessage?.id === message.id ? "bg-muted" : ""
                        } ${!message.isRead ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${categoryInfo.bgColor}`}>
                            <CategoryIcon className={`h-4 w-4 ${categoryInfo.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm truncate ${!message.isRead ? "font-semibold" : ""}`}>
                                {message.fromName || "MGR Capital"}
                              </p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(message.createdAt)}
                              </span>
                            </div>
                            <p className={`text-sm truncate ${!message.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                              {message.subject}
                            </p>
                            {message.case && (
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                Re: {message.case.propertyAddress || `${message.case.county}, ${message.case.state}`}
                              </p>
                            )}
                          </div>
                          {!message.isRead && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="p-8 text-center">
                <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No messages yet</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => setShowCompose(true)}
                >
                  Send your first message
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Detail */}
        <Card className="lg:col-span-2">
          {selectedMessage ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedMessage.subject}</CardTitle>
                    <CardDescription className="mt-1">
                      From: {selectedMessage.fromName || "MGR Capital Assistance"}
                      <span className="mx-2">|</span>
                      {formatDateTime(selectedMessage.createdAt)}
                    </CardDescription>
                  </div>
                  <Badge className={getCategoryInfo(selectedMessage.category).bgColor}>
                    {getCategoryInfo(selectedMessage.category).label}
                  </Badge>
                </div>
                {selectedMessage.case && (
                  <div className="mt-3 p-3 rounded-lg bg-muted">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Related Case: </span>
                      <Link href={`/client/cases/${selectedMessage.caseId}`} className="text-primary hover:underline">
                        {selectedMessage.case.propertyAddress || `${selectedMessage.case.county}, ${selectedMessage.case.state}`}
                      </Link>
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent className="py-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{selectedMessage.body}</p>
                </div>

                {/* Quick Actions */}
                <div className="mt-8 pt-6 border-t">
                  <p className="text-sm text-muted-foreground mb-3">Quick Actions:</p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" onClick={() => setShowCompose(true)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                    {selectedMessage.caseId && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/client/cases/${selectedMessage.caseId}`}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Case
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/client/documents">
                        <FileText className="h-4 w-4 mr-2" />
                        My Documents
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">Select a Message</h3>
                <p className="text-muted-foreground">
                  Choose a message from the list to view its contents
                </p>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Help Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold">We&apos;re Here to Help</h3>
                  <p className="text-sm text-muted-foreground">
                    Response times are typically within 1 business day
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>All communications are secure and confidential</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
