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
  Inbox,
  Globe,
  Bot,
  Phone,
  Search,
  Calendar,
  CreditCard,
  ShoppingBag,
  Blocks,
  GitBranch,
  Gavel,
  Activity,
  Eye,
  Network,
  UserCog,
  Zap,
  HardDrive,
  Clock,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  role: string;
  tier?: string | null;
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
    { href: "/founder/command-center", label: "Command Center", icon: Zap },
    { href: "/founder/pipeline", label: "Pipeline", icon: GitBranch },
    { href: "/founder/cases", label: "All Cases", icon: FileText },
    { href: "/founder/users", label: "User Management", icon: Users },
    { href: "/founder/ledger", label: "Ledger", icon: DollarSign },
    { href: "/founder/payments", label: "Payments", icon: CreditCard },
    { href: "/founder/payouts", label: "Nickel Payouts", icon: Send },
    { href: "/founder/ingestion", label: "Data Ingestion", icon: Upload },
    { href: "/founder/skip-trace", label: "Skip Tracing", icon: Search },
    { href: "/founder/phone-bot", label: "Phone Bot", icon: Phone },
    { href: "/founder/ai-bots", label: "AI Bots", icon: Bot },
    { href: "/founder/bots", label: "Bot Admin", icon: Activity },
    { href: "/founder/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/founder/insights", label: "Ops Insights", icon: Eye },
    { href: "/founder/ops", label: "Ops Center", icon: Activity },
    { href: "/founder/compliance", label: "Compliance", icon: Shield },
    { href: "/founder/hr", label: "HR Management", icon: UserCog },
    { href: "/founder/office-table", label: "Office Table", icon: Gavel },
    { href: "/founder/deadlines", label: "Deadlines", icon: Calendar },
    { href: "/founder/training", label: "Training", icon: BookOpen },
    { href: "/founder/comms", label: "Comms Chamber", icon: MessageSquare },
    { href: "/founder/inbox", label: "Inbox", icon: Inbox },
    { href: "/founder/emails", label: "Email Logs", icon: Mail },
    { href: "/founder/email-hosting", label: "Email Hosting", icon: Globe },
    { href: "/founder/documents/assignment", label: "Doc Assignment", icon: FileText },
    { href: "/founder/child-companies", label: "Child Companies", icon: Building2 },
    { href: "/founder/auctions", label: "Auctions", icon: Gavel },
    { href: "/founder/marketplace", label: "Marketplace", icon: ShoppingBag },
    { href: "/founder/nft", label: "NFT Claims", icon: Blocks },
    { href: "/founder/genealogy", label: "Genealogy", icon: Network },
    { href: "/founder/vr-simulation", label: "VR Simulation", icon: Eye },
    { href: "/founder/storage", label: "Storage Engine", icon: HardDrive },
    { href: "/founder/retention", label: "File Retention", icon: Clock },
    { href: "/founder/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/founder/alerts-chamber", label: "Alerts Chamber", icon: AlertTriangle },
    { href: "/founder/config", label: "Configuration", icon: Settings },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: Home },
    { href: "/admin/cases", label: "Cases", icon: FileText },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/insights", label: "Insights", icon: BarChart3 },
    { href: "/admin/compliance", label: "Compliance", icon: Shield },
    { href: "/admin/hr", label: "HR", icon: UserCog },
    { href: "/admin/comms", label: "Comms Chamber", icon: MessageSquare },
  ],
  employee: [
    { href: "/employee/dashboard", label: "Dashboard", icon: Home },
    { href: "/employee/cases", label: "My Cases", icon: FileText },
    { href: "/employee/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/employee/training", label: "Training", icon: BookOpen },
    { href: "/employee/compliance", label: "My Compliance", icon: Shield },
    { href: "/employee/comms", label: "Comms Chamber", icon: MessageSquare },
    { href: "/employee/bots", label: "Action Bots", icon: Bot },
    { href: "/employee/email", label: "Email", icon: Mail },
    // "My Company" link added dynamically based on tier eligibility (Tier 3+)
  ],
  client: [
    { href: "/client/dashboard", label: "Dashboard", icon: Home },
    { href: "/client/cases", label: "My Cases", icon: FileText },
    { href: "/client/documents", label: "Documents", icon: FileText },
    { href: "/client/messages", label: "Messages", icon: MessageSquare },
    { href: "/client/notifications", label: "Updates", icon: Bell },
  ],
};

// Tiers eligible for child company (Tier 3+) — growth surprise for lower tiers
const CHILD_COMPANY_ELIGIBLE_TIERS = [
  "TIER_3_SENIOR_SPECIALIST",
  "TIER_4_TEAM_LEADER",
  "TIER_5_EXECUTIVE_PARTNER",
];

export function Sidebar({ role, tier, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  let links = linksByRole[role.toLowerCase()] || [];

  // Dynamically add child company features for eligible employees (Tier 3+)
  // These are hidden from lower tiers as a "growth surprise"
  if (role.toLowerCase() === "employee" && tier && CHILD_COMPANY_ELIGIBLE_TIERS.includes(tier)) {
    links = [
      ...links,
      { href: "/employee/child-company", label: "My Company", icon: Building2 },
      { href: "/employee/alerts-chamber", label: "KidBuddy", icon: AlertTriangle },
    ];
  }

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

      {/* Sidebar — uses inline styles for guaranteed scroll behavior */}
      <nav
        className={cn(
          "fixed md:relative inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform duration-300 ease-in-out md:translate-x-0 md:block",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          maxHeight: "100%",
          overflow: "hidden",
        }}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1 md:hidden" style={{ flexShrink: 0 }}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Navigation
          </p>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Desktop header */}
        <div className="px-4 pt-3 pb-1 hidden md:block" style={{ flexShrink: 0 }}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
            Navigation
          </p>
        </div>

        {/* Scrollable nav links — inline overflow guarantees scrolling */}
        <div
          className="px-3 pb-3"
          style={{
            flex: "1 1 0%",
            minHeight: 0,
            overflowY: "auto",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <style>{`.sidebar-scroll::-webkit-scrollbar { display: none; }`}</style>
          <div className="sidebar-scroll space-y-0.5">
            {links.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-1.5 rounded-lg transition-colors text-[13px]",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
