"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Inbox,
  Send,
  FileEdit,
  Trash2,
  AlertTriangle,
  Search,
  RefreshCw,
  Star,
  StarOff,
  Mail,
  MailOpen,
  Reply,
  Forward,
  MoreHorizontal,
  Plus,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { EmailComposer } from "@/components/EmailComposer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, sanitizeHtml } from "@/lib/utils";

interface Email {
  id: string;
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  cc?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: { id: string; filename: string; size: number; mimeType: string }[];
  createdAt: string;
}

interface FolderCount {
  folder: string;
  total: number;
  unread: number;
}

const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileEdit },
  { id: "trash", label: "Trash", icon: Trash2 },
];

export default function EmployeeInboxPage() {
  const queryClient = useQueryClient();
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "forward">("new");
  const [replyToEmail, setReplyToEmail] = useState<Email | undefined>(undefined);

  // Fetch user's email account info
  const { data: emailAccount } = useQuery({
    queryKey: ["my-email-account"],
    queryFn: async () => {
      const { data } = await api.get("/email-hosting/accounts");
      // Return the first active email account
      return data.data?.find((acc: any) => acc.status === "ACTIVE");
    },
  });

  // Fetch folder counts
  const { data: folderCounts } = useQuery({
    queryKey: ["employee-email-folder-counts"],
    queryFn: async () => {
      const { data } = await api.get("/inbox/folders/counts");
      return data.data as FolderCount[];
    },
    enabled: !!emailAccount,
  });

  // Fetch emails for selected folder
  const { data: emailsData, isLoading: emailsLoading, error: emailsError } = useQuery({
    queryKey: ["employee-emails", selectedFolder, page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        folder: selectedFolder,
        page: String(page),
        pageSize: "25",
      });
      if (search) params.set("search", search);
      const { data } = await api.get(`/inbox/emails?${params}`);
      return data;
    },
    enabled: !!emailAccount,
  });

  // Fetch single email details
  const { data: emailDetails, isLoading: emailDetailsLoading } = useQuery({
    queryKey: ["employee-email", selectedEmail?.id],
    queryFn: async () => {
      if (!selectedEmail?.id) return null;
      const { data } = await api.get(`/inbox/emails/${selectedEmail.id}`);
      return data.data as Email;
    },
    enabled: !!selectedEmail?.id && !!emailAccount,
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      const { data } = await api.patch(`/inbox/emails/${id}`, { isRead });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-emails"] });
      queryClient.invalidateQueries({ queryKey: ["employee-email-folder-counts"] });
    },
  });

  // Toggle star mutation
  const toggleStarMutation = useMutation({
    mutationFn: async ({ id, isStarred }: { id: string; isStarred: boolean }) => {
      const { data } = await api.patch(`/inbox/emails/${id}`, { isStarred });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-emails"] });
    },
  });

  // Move to folder mutation
  const moveToFolderMutation = useMutation({
    mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
      const { data } = await api.patch(`/inbox/emails/${id}`, { folder });
      return data;
    },
    onSuccess: (_, { folder }) => {
      toast.success(`Email moved to ${folder}`);
      queryClient.invalidateQueries({ queryKey: ["employee-emails"] });
      queryClient.invalidateQueries({ queryKey: ["employee-email-folder-counts"] });
      if (selectedEmail) setSelectedEmail(null);
    },
    onError: () => {
      toast.error("Failed to move email");
    },
  });

  // Delete email mutation
  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/inbox/emails/${id}`);
      return data;
    },
    onSuccess: () => {
      toast.success("Email deleted");
      queryClient.invalidateQueries({ queryKey: ["employee-emails"] });
      queryClient.invalidateQueries({ queryKey: ["employee-email-folder-counts"] });
      setSelectedEmail(null);
    },
    onError: () => {
      toast.error("Failed to delete email");
    },
  });

  // Auto-mark as read when selecting an email
  useEffect(() => {
    if (selectedEmail && !selectedEmail.isRead) {
      markReadMutation.mutate({ id: selectedEmail.id, isRead: true });
    }
  }, [selectedEmail?.id]);

  const getUnreadCount = (folderId: string): number => {
    const folder = folderCounts?.find((f) => f.folder === folderId);
    return folder?.unread || 0;
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
  };

  const handleReply = () => {
    if (emailDetails) {
      setReplyToEmail(emailDetails);
      setComposeMode("reply");
      setComposeOpen(true);
    }
  };

  const handleForward = () => {
    if (emailDetails) {
      setReplyToEmail(emailDetails);
      setComposeMode("forward");
      setComposeOpen(true);
    }
  };

  const handleNewEmail = () => {
    setReplyToEmail(undefined);
    setComposeMode("new");
    setComposeOpen(true);
  };

  const handleComposeClose = () => {
    setComposeOpen(false);
    setReplyToEmail(undefined);
    setComposeMode("new");
  };

  const handleComposeSend = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-emails"] });
    queryClient.invalidateQueries({ queryKey: ["employee-email-folder-counts"] });
    handleComposeClose();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // If no email account, show setup prompt
  if (!emailAccount) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Mail className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Email Account</h2>
            <p className="text-muted-foreground mb-4">
              You need to set up a professional email account to access your inbox.
            </p>
            <Button asChild>
              <a href="/employee/email/setup">
                <Plus className="h-4 w-4 mr-2" />
                Set Up Email Account
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">My Inbox</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            {emailAccount.email}
          </p>
        </div>
        <Button onClick={handleNewEmail}>
          <Plus className="h-4 w-4 mr-2" />
          Compose
        </Button>
      </div>

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Folder Navigation */}
        <Card className="w-44 flex-shrink-0">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {FOLDERS.map(({ id, label, icon: Icon }) => {
                const unread = getUnreadCount(id);
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedFolder(id);
                      setSelectedEmail(null);
                      setPage(1);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      selectedFolder === id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </div>
                    {unread > 0 && (
                      <Badge
                        variant={selectedFolder === id ? "secondary" : "default"}
                        className="ml-2 h-5 min-w-[20px] px-1.5 text-xs"
                      >
                        {unread}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Email List */}
        <Card className="w-72 flex-shrink-0 flex flex-col">
          <CardHeader className="py-3 px-4 border-b">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-8"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["employee-emails"] })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            {emailsLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : emailsError ? (
              <div className="p-4 text-center text-sm text-red-500">
                Failed to load emails
              </div>
            ) : emailsData?.data?.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No emails"
                description={search ? "No emails match your search" : "This folder is empty"}
              />
            ) : (
              <ScrollArea className="h-full">
                <div className="divide-y">
                  {emailsData?.data?.map((email: Email) => (
                    <button
                      key={email.id}
                      onClick={() => handleSelectEmail(email)}
                      className={cn(
                        "w-full text-left px-4 py-3 transition-colors",
                        selectedEmail?.id === email.id
                          ? "bg-muted"
                          : "hover:bg-muted/50",
                        !email.isRead && "bg-blue-50 dark:bg-blue-950/20"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStarMutation.mutate({
                              id: email.id,
                              isStarred: !email.isStarred,
                            });
                          }}
                          className="mt-0.5 text-muted-foreground hover:text-yellow-500"
                        >
                          {email.isStarred ? (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-sm",
                                !email.isRead && "font-semibold"
                              )}
                            >
                              {email.fromName || email.from}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(email.createdAt)}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "text-sm truncate",
                              !email.isRead
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {email.subject || "(No Subject)"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {email.body?.replace(/<[^>]*>/g, "").slice(0, 50)}...
                          </p>
                        </div>
                        {email.hasAttachments && (
                          <Paperclip className="h-3 w-3 text-muted-foreground mt-1" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
          {/* Pagination */}
          {emailsData?.totalPages > 1 && (
            <div className="border-t px-4 py-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Page {emailsData.page} of {emailsData.totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= emailsData.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Email Preview */}
        <Card className="flex-1 flex flex-col min-w-0">
          {selectedEmail ? (
            <>
              <CardHeader className="py-3 px-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReply}>
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleForward}>
                      <Forward className="h-4 w-4 mr-1" />
                      Forward
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        markReadMutation.mutate({
                          id: selectedEmail.id,
                          isRead: !selectedEmail.isRead,
                        });
                        setSelectedEmail({ ...selectedEmail, isRead: !selectedEmail.isRead });
                      }}
                    >
                      {selectedEmail.isRead ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <MailOpen className="h-4 w-4" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            moveToFolderMutation.mutate({
                              id: selectedEmail.id,
                              folder: "trash",
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Move to Trash
                        </DropdownMenuItem>
                        {selectedFolder === "trash" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                moveToFolderMutation.mutate({
                                  id: selectedEmail.id,
                                  folder: "inbox",
                                })
                              }
                            >
                              <Inbox className="h-4 w-4 mr-2" />
                              Move to Inbox
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteEmailMutation.mutate(selectedEmail.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1 overflow-hidden flex flex-col">
                {emailDetailsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : emailDetails ? (
                  <>
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold mb-2">
                        {emailDetails.subject || "(No Subject)"}
                      </h2>
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">From: </span>
                          {emailDetails.fromName
                            ? `${emailDetails.fromName} <${emailDetails.from}>`
                            : emailDetails.from}
                        </p>
                        <p>
                          <span className="text-muted-foreground">To: </span>
                          {emailDetails.toName
                            ? `${emailDetails.toName} <${emailDetails.to}>`
                            : emailDetails.to}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Date: </span>
                          {new Date(emailDetails.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Attachments */}
                    {emailDetails.attachments && emailDetails.attachments.length > 0 && (
                      <div className="mb-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          Attachments ({emailDetails.attachments.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {emailDetails.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/inbox/attachments/${att.id}`}
                              download={att.filename}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded border text-xs hover:bg-muted transition-colors"
                            >
                              <Paperclip className="h-3 w-3" />
                              {att.filename}
                              <span className="text-muted-foreground">
                                ({Math.round(att.size / 1024)}KB)
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Email Body */}
                    <ScrollArea className="flex-1">
                      {emailDetails.bodyHtml ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(emailDetails.bodyHtml) }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm">
                          {emailDetails.body}
                        </div>
                      )}
                    </ScrollArea>
                  </>
                ) : null}
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon="inbox"
                title="Select an email"
                description="Choose an email from the list to view its contents"
              />
            </div>
          )}
        </Card>
      </div>

      {/* Compose Modal */}
      <EmailComposer
        open={composeOpen}
        onClose={handleComposeClose}
        onSend={handleComposeSend}
        mode={composeMode}
        originalEmail={replyToEmail}
        defaultFrom={emailAccount?.email}
      />
    </div>
  );
}
