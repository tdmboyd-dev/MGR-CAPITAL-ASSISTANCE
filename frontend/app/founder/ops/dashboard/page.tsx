"use client";

/**
 * Founder Customizable Dashboard — MGR CAPITAL ASSISTANCE
 * Phase 20: Drag-and-Drop Widget Layout
 */

import { CustomizableDashboard } from "@/components/CustomizableDashboard";
import { LayoutGrid } from "lucide-react";

export default function FounderCustomDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <LayoutGrid className="h-7 w-7 md:h-8 md:w-8" />
          Customizable Dashboard
        </h1>
        <p className="text-muted-foreground">
          Drag and resize widgets to create your ideal workspace. Click the lock icon to enable editing.
        </p>
      </div>

      <CustomizableDashboard storageKey="mgr-founder-dashboard" />
    </div>
  );
}
