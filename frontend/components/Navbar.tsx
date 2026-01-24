"use client";

import { Moon, Sun, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AiSearchBar } from "@/components/AiSearchBar";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { NotificationBell } from "@/components/NotificationBell";
import { useRouter } from "next/navigation";

interface NavbarProps {
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
}

export function Navbar({ onMenuToggle, isSidebarOpen }: NavbarProps) {
  const { theme, setTheme, user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || "U";
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case "FOUNDER":
        return "bg-purple-600";
      case "ADMIN":
        return "bg-blue-600";
      case "EMPLOYEE":
        return "bg-green-600";
      case "CLIENT":
        return "bg-orange-600";
      default:
        return "bg-gray-600";
    }
  };

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b bg-card">
      <div className="flex items-center space-x-3 md:space-x-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
          aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">M</span>
          </div>
          <span className="text-lg md:text-xl font-bold hidden sm:inline">MGR Capital</span>
          <span className="text-lg font-bold sm:hidden">MGR</span>
        </div>
      </div>

      {/* Global Search Bar - hidden on mobile */}
      <div className="hidden md:flex flex-1 max-w-xl mx-4">
        <GlobalSearchBar />
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <div className="hidden sm:block">
          <NotificationBell />
        </div>

        <div className="flex items-center space-x-2 md:space-x-3 pl-2 md:pl-4 border-l">
          <Avatar className={getRoleColor(user?.role)}>
            <AvatarFallback className="bg-transparent text-white text-xs md:text-sm font-medium">
              {getInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:block">
            <p className="text-sm font-medium">{user?.name || user?.email}</p>
            <p className="text-xs text-muted-foreground">{user?.role}</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
