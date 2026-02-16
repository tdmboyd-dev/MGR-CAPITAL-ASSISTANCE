"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Send,
  Save,
  Paperclip,
  X,
  User,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Attachment {
  file: File;
  id: string;
}

export default function ComposeEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get initial values from URL params (for reply/forward)
  const initialTo = searchParams.get("to") || "";
  const initialSubject = searchParams.get("subject") || "";
  const initialBody = searchParams.get("body") || "";
  const replyToId = searchParams.get("replyTo");
  const forwardId = searchParams.get("forward");

  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Fetch original email if replying or forwarding
  const { data: originalEmail } = useQuery({
    queryKey: ["email", replyToId || forwardId],
    queryFn: async () => {
      const id = replyToId || forwardId;
      if (!id) return null;
      const { data } = await api.get(`/api/inbox/emails/${id}`);
      return data.data;
    },
    enabled: !!(replyToId || forwardId),
  });

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post("/inbox/emails/send", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Email sent successfully");
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["email-folder-counts"] });
      router.push("/founder/inbox");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to send email");
    },
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (draftData: object) => {
      const { data } = await api.post("/inbox/emails/draft", draftData);
      return data;
    },
    onSuccess: () => {
      toast.success("Draft saved");
      queryClient.invalidateQueries({ queryKey: ["emails", "drafts"] });
    },
    onError: () => {
      toast.error("Failed to save draft");
    },
  });

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map((file) => ({
        file,
        id: Math.random().toString(36).substring(7),
      }));
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if (!to.trim()) {
      toast.error("Please enter a recipient");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }

    const formData = new FormData();
    formData.append("to", to);
    if (cc) formData.append("cc", cc);
    if (bcc) formData.append("bcc", bcc);
    formData.append("subject", subject);
    formData.append("body", body);
    if (replyToId) formData.append("replyToId", replyToId);
    if (forwardId) formData.append("forwardFromId", forwardId);

    attachments.forEach((att) => {
      formData.append("attachments", att.file);
    });

    sendMutation.mutate(formData);
  };

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      body,
      replyToId: replyToId || undefined,
      forwardFromId: forwardId || undefined,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isLoading = sendMutation.isPending || saveDraftMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/founder/inbox">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {replyToId ? "Reply" : forwardId ? "Forward" : "New Email"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Compose and send your message
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Compose Message</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isLoading}
              >
                {saveDraftMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Draft
              </Button>
              <Button onClick={handleSend} disabled={isLoading}>
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* To Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="to" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                To
              </Label>
              <div className="flex gap-2 text-sm">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="text-primary hover:underline"
                  >
                    CC
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="text-primary hover:underline"
                  >
                    BCC
                  </button>
                )}
              </div>
            </div>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* CC Field */}
          {showCc && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cc" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  CC
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCc(false);
                    setCc("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                id="cc"
                type="email"
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {/* BCC Field */}
          {showBcc && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bcc" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  BCC
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setShowBcc(false);
                    setBcc("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                id="bcc"
                type="email"
                placeholder="bcc@example.com"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Subject Field */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleAddAttachment}
                className="hidden"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Add File
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {attachments.map((att) => (
                  <Badge
                    key={att.id}
                    variant="secondary"
                    className="flex items-center gap-2 pr-1"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[150px] truncate">{att.file.name}</span>
                    <span className="text-muted-foreground">
                      ({formatFileSize(att.file.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="ml-1 p-0.5 rounded hover:bg-muted-foreground/20"
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Body Field */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Write your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isLoading}
              className="min-h-[300px] resize-y"
            />
          </div>

          {/* Original Email Quote (for reply/forward) */}
          {originalEmail && (
            <div className="border-l-4 border-muted pl-4 py-2 text-sm text-muted-foreground">
              <p className="font-medium mb-1">
                On {new Date(originalEmail.createdAt).toLocaleString()},{" "}
                {originalEmail.fromName || originalEmail.from} wrote:
              </p>
              <div className="whitespace-pre-wrap">
                {originalEmail.body?.replace(/<[^>]*>/g, "").slice(0, 500)}
                {originalEmail.body?.length > 500 && "..."}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
