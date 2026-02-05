"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineHandler } from "@/components/OfflineHandler";

interface DashboardLayoutProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export function DashboardLayout({ children, allowedRoles }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      router.replace("/auth/login");
      return;
    }

    if (user && !allowedRoles.includes(user.role)) {
      switch (user.role) {
        case "FOUNDER":
          router.replace("/founder/dashboard");
          break;
        case "ADMIN":
          router.replace("/admin/dashboard");
          break;
        case "EMPLOYEE":
          router.replace("/employee/dashboard");
          break;
        case "CLIENT":
          router.replace("/client/dashboard");
          break;
        default:
          router.replace("/auth/login");
      }
    }
  }, [user, accessToken, router, allowedRoles]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  if (!accessToken || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-background">
        <Navbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          isSidebarOpen={sidebarOpen}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            role={user.role}
            tier={user.tier}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
        <OfflineHandler />
      </div>
    </ErrorBoundary>
  );
}
