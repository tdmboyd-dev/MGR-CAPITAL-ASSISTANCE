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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: string;
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
    { href: "/founder/ingestion", label: "Data Ingestion", icon: Upload },
    { href: "/founder/insights", label: "Ops Insights", icon: BarChart3 },
    { href: "/founder/training", label: "Training", icon: BookOpen },
    { href: "/founder/comms", label: "Comms Chamber", icon: MessageSquare },
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
  ],
  client: [
    { href: "/client/dashboard", label: "Portal", icon: Home },
    { href: "/client/cases", label: "My Cases", icon: FileText },
    { href: "/client/documents", label: "Documents", icon: Shield },
    { href: "/client/notifications", label: "Updates", icon: Bell },
  ],
};

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const links = linksByRole[role.toLowerCase()] || [];

  return (
    <nav className="w-64 border-r bg-card p-4 space-y-2 hidden md:block">
      <div className="mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
          Navigation
        </p>
      </div>
      {links.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
