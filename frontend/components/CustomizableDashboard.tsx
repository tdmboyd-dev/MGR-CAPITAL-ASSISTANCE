"use client";

/**
 * Customizable Dashboard — MGR CAPITAL ASSISTANCE
 * Phase 20: Drag-and-Drop Widget Layout
 *
 * Uses react-grid-layout for draggable/resizable widgets.
 * Persists layout in localStorage per user role.
 */

import { useState, useEffect, useCallback } from "react";
import { Responsive, WidthProvider, Layout } from "react-grid-layout";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  Unlock,
  RotateCcw,
  Settings,
  DollarSign,
  FileText,
  Users,
  AlertTriangle,
  TrendingUp,
  Activity,
  Bot,
  Bell,
} from "lucide-react";

// Import styles for react-grid-layout
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

// Widget definitions
interface WidgetConfig {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  minW: number;
  minH: number;
  component: React.ComponentType<any>;
}

// Widget components
function RevenueWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-revenue"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/forecast");
      return data.data;
    },
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  return (
    <div className="h-full flex flex-col justify-center items-center">
      <p className="text-3xl font-bold text-green-500">
        ${((data?.summary?.predictedRevenue30d || 0) / 100).toLocaleString()}
      </p>
      <p className="text-sm text-muted-foreground">Predicted Revenue (30d)</p>
      <div className="flex items-center gap-1 mt-2">
        <TrendingUp className="h-4 w-4 text-green-500" />
        <span className="text-xs text-green-500">
          {data?.summary?.trend === "up" ? "Trending up" : "Stable"}
        </span>
      </div>
    </div>
  );
}

function CasesWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-cases"],
    queryFn: async () => {
      const { data } = await api.get("/cases?limit=5");
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const cases = data?.data || [];

  return (
    <div className="h-full overflow-auto">
      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No recent cases</p>
      ) : (
        <div className="space-y-2">
          {cases.slice(0, 5).map((c: any) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <span className="text-sm font-medium truncate">{c.caseCode}</span>
              <Badge variant="outline" className="text-xs">
                {c.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-alerts"],
    queryFn: async () => {
      const { data } = await api.get("/ops/watch/alerts?limit=5&resolved=false");
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const alerts = data?.data || [];

  return (
    <div className="h-full overflow-auto">
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">No active alerts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, 5).map((alert: any) => (
            <div
              key={alert.id}
              className={`p-2 rounded-lg border-l-4 ${
                alert.severity === "CRITICAL"
                  ? "border-l-red-500 bg-red-500/10"
                  : alert.severity === "HIGH"
                  ? "border-l-orange-500 bg-orange-500/10"
                  : "border-l-yellow-500 bg-yellow-500/10"
              }`}
            >
              <p className="text-sm font-medium truncate">{alert.message}</p>
              <p className="text-xs text-muted-foreground">{alert.type}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeesWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-employees"],
    queryFn: async () => {
      const { data } = await api.get("/employees?limit=5");
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const employees = data?.data || [];

  return (
    <div className="h-full overflow-auto">
      {employees.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No employees</p>
      ) : (
        <div className="space-y-2">
          {employees.slice(0, 5).map((emp: any) => (
            <div
              key={emp.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <div>
                <p className="text-sm font-medium">
                  {emp.firstName} {emp.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{emp.email}</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {emp.tier?.replace("TIER_", "T")}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SystemHealthWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-health"],
    queryFn: async () => {
      const { data } = await api.get("/health");
      return data;
    },
    refetchInterval: 60000,
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const status = data?.status || "unknown";

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center ${
          status === "ok"
            ? "bg-green-500/20"
            : status === "degraded"
            ? "bg-yellow-500/20"
            : "bg-red-500/20"
        }`}
      >
        <Activity
          className={`h-8 w-8 ${
            status === "ok"
              ? "text-green-500"
              : status === "degraded"
              ? "text-yellow-500"
              : "text-red-500"
          }`}
        />
      </div>
      <p className="mt-3 text-lg font-semibold capitalize">{status}</p>
      <p className="text-xs text-muted-foreground">v{data?.version || "1.0.0"}</p>
    </div>
  );
}

function BotStatusWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-bots"],
    queryFn: async () => {
      const { data } = await api.get("/ops/metrics/bots");
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const bots = data?.data || [];
  const avgSuccess =
    bots.length > 0
      ? Math.round(bots.reduce((sum: number, b: any) => sum + b.successRate, 0) / bots.length)
      : 0;

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <Bot className="h-10 w-10 text-primary mb-2" />
      <p className="text-2xl font-bold">{bots.length}</p>
      <p className="text-sm text-muted-foreground">Active Bots</p>
      <Badge variant={avgSuccess >= 90 ? "default" : "secondary"} className="mt-2">
        {avgSuccess}% Success Rate
      </Badge>
    </div>
  );
}

function NotificationsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-notifications"],
    queryFn: async () => {
      const { data } = await api.get("/notifications?unread=true&limit=5");
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  const notifications = data?.data || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-4 w-4" />
        <span className="text-sm font-medium">{unreadCount} unread</span>
      </div>
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">All caught up!</p>
      ) : (
        <div className="space-y-2">
          {notifications.slice(0, 5).map((n: any) => (
            <div key={n.id} className="p-2 rounded-lg bg-muted/50 border-l-2 border-primary">
              <p className="text-sm truncate">{n.content}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Available widgets
const AVAILABLE_WIDGETS: WidgetConfig[] = [
  {
    id: "revenue",
    title: "Revenue Forecast",
    description: "30-day revenue prediction",
    icon: <DollarSign className="h-4 w-4" />,
    minW: 2,
    minH: 2,
    component: RevenueWidget,
  },
  {
    id: "cases",
    title: "Recent Cases",
    description: "Latest case updates",
    icon: <FileText className="h-4 w-4" />,
    minW: 2,
    minH: 2,
    component: CasesWidget,
  },
  {
    id: "alerts",
    title: "Active Alerts",
    description: "Unresolved system alerts",
    icon: <AlertTriangle className="h-4 w-4" />,
    minW: 2,
    minH: 2,
    component: AlertsWidget,
  },
  {
    id: "employees",
    title: "Team Overview",
    description: "Employee status",
    icon: <Users className="h-4 w-4" />,
    minW: 2,
    minH: 2,
    component: EmployeesWidget,
  },
  {
    id: "health",
    title: "System Health",
    description: "API status",
    icon: <Activity className="h-4 w-4" />,
    minW: 1,
    minH: 2,
    component: SystemHealthWidget,
  },
  {
    id: "bots",
    title: "Bot Status",
    description: "Automation health",
    icon: <Bot className="h-4 w-4" />,
    minW: 1,
    minH: 2,
    component: BotStatusWidget,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Unread messages",
    icon: <Bell className="h-4 w-4" />,
    minW: 2,
    minH: 2,
    component: NotificationsWidget,
  },
];

// Default layouts per breakpoint
const DEFAULT_LAYOUTS: { [key: string]: Layout[] } = {
  lg: [
    { i: "revenue", x: 0, y: 0, w: 3, h: 2 },
    { i: "health", x: 3, y: 0, w: 2, h: 2 },
    { i: "bots", x: 5, y: 0, w: 2, h: 2 },
    { i: "cases", x: 0, y: 2, w: 4, h: 3 },
    { i: "alerts", x: 4, y: 2, w: 3, h: 3 },
    { i: "employees", x: 0, y: 5, w: 3, h: 3 },
    { i: "notifications", x: 3, y: 5, w: 4, h: 3 },
  ],
  md: [
    { i: "revenue", x: 0, y: 0, w: 3, h: 2 },
    { i: "health", x: 3, y: 0, w: 2, h: 2 },
    { i: "bots", x: 5, y: 0, w: 2, h: 2 },
    { i: "cases", x: 0, y: 2, w: 4, h: 3 },
    { i: "alerts", x: 4, y: 2, w: 3, h: 3 },
    { i: "employees", x: 0, y: 5, w: 3, h: 3 },
    { i: "notifications", x: 3, y: 5, w: 4, h: 3 },
  ],
  sm: [
    { i: "revenue", x: 0, y: 0, w: 6, h: 2 },
    { i: "health", x: 0, y: 2, w: 3, h: 2 },
    { i: "bots", x: 3, y: 2, w: 3, h: 2 },
    { i: "cases", x: 0, y: 4, w: 6, h: 3 },
    { i: "alerts", x: 0, y: 7, w: 6, h: 3 },
    { i: "employees", x: 0, y: 10, w: 6, h: 3 },
    { i: "notifications", x: 0, y: 13, w: 6, h: 3 },
  ],
};

interface CustomizableDashboardProps {
  storageKey?: string;
}

export function CustomizableDashboard({
  storageKey = "mgr-dashboard-layout",
}: CustomizableDashboardProps) {
  const { user } = useAuth();
  const [layouts, setLayouts] = useState<{ [key: string]: Layout[] }>(DEFAULT_LAYOUTS);
  const [isLocked, setIsLocked] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Load saved layout from localStorage
  useEffect(() => {
    setMounted(true);
    const savedLayout = localStorage.getItem(`${storageKey}-${user?.role}`);
    if (savedLayout) {
      try {
        setLayouts(JSON.parse(savedLayout));
      } catch (e) {
        console.error("Failed to parse saved layout:", e);
      }
    }
  }, [storageKey, user?.role]);

  // Save layout changes
  const handleLayoutChange = useCallback(
    (_currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
      if (!isLocked && mounted) {
        setLayouts(allLayouts);
        localStorage.setItem(`${storageKey}-${user?.role}`, JSON.stringify(allLayouts));
      }
    },
    [isLocked, mounted, storageKey, user?.role]
  );

  // Reset to default layout
  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS);
    localStorage.removeItem(`${storageKey}-${user?.role}`);
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={isLocked ? "outline" : "default"}
            size="sm"
            onClick={() => setIsLocked(!isLocked)}
          >
            {isLocked ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Locked
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Editing
              </>
            )}
          </Button>
          {!isLocked && (
            <Button variant="ghost" size="sm" onClick={resetLayout}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Layout
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid Layout */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768 }}
        cols={{ lg: 7, md: 6, sm: 6 }}
        rowHeight={100}
        isDraggable={!isLocked}
        isResizable={!isLocked}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
        margin={[16, 16]}
      >
        {AVAILABLE_WIDGETS.map((widget) => (
          <div key={widget.id} className="widget-container">
            <Card className="h-full flex flex-col overflow-hidden">
              <CardHeader className="pb-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {widget.icon}
                    {widget.title}
                  </CardTitle>
                  {!isLocked && (
                    <div className="widget-drag-handle cursor-move p-1 rounded hover:bg-muted">
                      <Settings className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {widget.description && (
                  <CardDescription className="text-xs">{widget.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <widget.component />
              </CardContent>
            </Card>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
