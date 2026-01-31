"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  FileText,
  MessageSquare,
  Settings,
  BookOpen,
  DollarSign,
  BarChart3,
  Bell,
  Upload,
  Shield,
  X,
  Building2,
  Send,
  Mail,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  role: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const linksByRole: Record<string, NavLink[]> = {
  founder: [
    { href: "/founder/dashboard", label: "Dashboard", icon: Home },
    { href: "/founder/cases", label: "All Cases", icon: FileText },
    { href: "/founder/users", label: "User Management", icon: Users },
    { href: "/founder/ledger", label: "Ledger", icon: DollarSign },
    { href: "/founder/payouts", label: "Nickel Payouts", icon: Send },
    { href: "/founder/ingestion", label: "Data Ingestion", icon: Upload },
    { href: "/founder/insights", label: "Ops Insights", icon: BarChart3 },
    { href: "/founder/training", label: "Training", icon: BookOpen },
    { href: "/founder/comms", label: "Comms Chamber", icon: MessageSquare },
    { href: "/founder/emails", label: "Email Logs", icon: Mail },
    { href: "/founder/child-companies", label: "Child Companies", icon: Building2 },
    { href: "/founder/email-hosting", label: "Email Hosting", icon: Globe },
    { href: "/founder/config", label: "Configuration", icon: Settings },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: Home },
    { href: "/admin/cases", label: "Cases", icon: FileText },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/insights", label: "Insights", icon: BarChart3 },
    { href: "/admin/comms", label: "Comms Chamber", icon: MessageSquare },
  ],
  employee: [
    { href: "/employee/dashboard", label: "Dashboard", icon: Home },
    { href: "/employee/cases", label: "My Cases", icon: FileText },
    { href: "/employee/training", label: "Training", icon: BookOpen },
    { href: "/employee/comms", label: "Comms Chamber", icon: MessageSquare },
    { href: "/employee/child-company", label: "My Company", icon: Building2 },
    { href: "/employee/email", label: "Email", icon: Mail },
  ],
  client: [
    { href: "/client/dashboard", label: "Portal", icon: Home },
    { href: "/client/cases", label: "My Cases", icon: FileText },
    { href: "/client/documents", label: "Documents", icon: Shield },
    { href: "/client/notifications", label: "Updates", icon: Bell },
  ],
};

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const links = linksByRole[role.toLowerCase()] || [];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <nav
        className={cn(
          "fixed md:relative inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform duration-300 ease-in-out md:translate-x-0 md:block flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between px-4 pt-4 mb-2 md:hidden">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Navigation
          </p>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Desktop header */}
        <div className="px-4 pt-4 mb-2 hidden md:block">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
            Navigation
          </p>
        </div>

        {/* Scrollable nav links */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
        </div>
      </nav>
    </>
  );
}
