"use client";
import { apiFailure } from "@/lib/apiFailure";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation,useQueryClient } from "@tanstack/react-query";
import {
Loader2,
Maximize2,
Minimize2,
Paperclip,
Save,
Send,
User,
Users,
X,
} from "lucide-react";
import { useRef,useState } from "react";
import { toast } from "sonner";

interface Email {
  id: string;
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  createdAt: string;
}

interface Attachment {
  file: File;
  id: string;
}

interface EmailComposerProps {
  open: boolean;
  onClose: () => void;
  onSend?: () => void;
  mode: "new" | "reply" | "forward";
  originalEmail?: Email;
  defaultFrom?: string;  // Employee's email address for sending
}

export function EmailComposer(props: EmailComposerProps) {
  if (!props.open) return null;
  return <EmailComposerSession key={`${props.mode}:${props.originalEmail?.id ?? 'new'}`} {...props} />;
}

function EmailComposerSession({
  open,
  onClose,
  onSend,
  mode,
  originalEmail,
}: EmailComposerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Form state
  const [to, setTo] = useState(mode === "reply" ? originalEmail?.from ?? "" : "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(() => {
    if (!originalEmail || mode === 'new') return '';
    const prefix = mode === 'reply' ? 'Re:' : 'Fwd:';
    return originalEmail.subject.startsWith(prefix) ? originalEmail.subject : `${prefix} ${originalEmail.subject}`;
  });
  const [body, setBody] = useState(() => {
    if (!originalEmail || mode === 'new') return '';
    const plain = originalEmail.body?.replace(/<[^>]*>/g, '') ?? '';
    const sender = originalEmail.fromName || originalEmail.from;
    const date = new Date(originalEmail.createdAt).toLocaleString();
    return mode === 'reply' ? `\n\n---\nOn ${date}, ${sender} wrote:\n\n${plain}`
      : `\n\n---\nForwarded message:\nFrom: ${sender}\nDate: ${date}\nSubject: ${originalEmail.subject}\n\n${plain}`;
  });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post("/api/inbox/emails/send", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Email sent successfully");
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["email-folder-counts"] });
      onSend?.();
    },
    onError: (errorUnknown: unknown) => {
      const error = apiFailure(errorUnknown);
      toast.error(error.response?.data?.error || "Failed to send email");
    },
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (draftData: object) => {
      const { data } = await api.post("/api/inbox/emails/draft", draftData);
      return data;
    },
    onSuccess: () => {
      toast.success("Draft saved");
      queryClient.invalidateQueries({ queryKey: ["emails", "drafts"] });
      onClose();
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

    if (mode === "reply" && originalEmail) {
      formData.append("replyToId", originalEmail.id);
    }
    if (mode === "forward" && originalEmail) {
      formData.append("forwardFromId", originalEmail.id);
    }

    attachments.forEach((att) => {
      formData.append("attachments", att.file);
    });

    sendMutation.mutate(formData);
  };

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({
      to: to || undefined,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: subject || undefined,
      body: body || undefined,
      replyToId: mode === "reply" && originalEmail ? originalEmail.id : undefined,
      forwardFromId: mode === "forward" && originalEmail ? originalEmail.id : undefined,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isLoading = sendMutation.isPending || saveDraftMutation.isPending;

  const getTitle = () => {
    switch (mode) {
      case "reply":
        return "Reply";
      case "forward":
        return "Forward";
      default:
        return "New Message";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col",
          isMaximized
            ? "max-w-[90vw] w-[90vw] h-[90vh] max-h-[90vh]"
            : "max-w-2xl w-full max-h-[85vh]"
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>{getTitle()}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMaximized(!isMaximized)}
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* To Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="compose-to" className="flex items-center gap-2">
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
              id="compose-to"
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
                <Label htmlFor="compose-cc" className="flex items-center gap-2">
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
                id="compose-cc"
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
                <Label htmlFor="compose-bcc" className="flex items-center gap-2">
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
                id="compose-bcc"
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
            <Label htmlFor="compose-subject">Subject</Label>
            <Input
              id="compose-subject"
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
            <Label htmlFor="compose-body">Message</Label>
            <Textarea
              id="compose-body"
              placeholder="Write your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isLoading}
              className={cn(
                "resize-y",
                isMaximized ? "min-h-[400px]" : "min-h-[200px]"
              )}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
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
      </DialogContent>
    </Dialog>
  );
}
