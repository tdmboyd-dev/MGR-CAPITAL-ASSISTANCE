"use client";

import { ReactNode } from "react";
import { FileText, BookOpen, MessageSquare, Inbox, Search, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: "cases" | "training" | "messages" | "inbox" | "search" | "folder";
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

const icons = {
  cases: FileText,
  training: BookOpen,
  messages: MessageSquare,
  inbox: Inbox,
  search: Search,
  folder: FolderOpen,
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  const Icon = icons[icon];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
