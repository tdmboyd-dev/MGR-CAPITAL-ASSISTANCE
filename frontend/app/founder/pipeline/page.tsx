"use client";

import { DashboardLayout } from "@/components/DashboardLayout";
import LeadPipelineKanban from "@/components/LeadPipelineKanban";

export default function PipelinePage() {
  return (
    <DashboardLayout allowedRoles={["FOUNDER", "ADMIN"]}>
      <div className="h-[calc(100vh-100px)]">
        <LeadPipelineKanban />
      </div>
    </DashboardLayout>
  );
}
