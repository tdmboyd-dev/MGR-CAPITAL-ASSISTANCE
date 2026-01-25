"use client";

import DashboardLayout from "@/components/DashboardLayout";
import LeadPipelineKanban from "@/components/LeadPipelineKanban";

export default function PipelinePage() {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-100px)]">
        <LeadPipelineKanban />
      </div>
    </DashboardLayout>
  );
}
