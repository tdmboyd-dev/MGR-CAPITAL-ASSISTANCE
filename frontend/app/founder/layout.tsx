"use client";

import { DashboardLayout } from "@/components/DashboardLayout";

export default function FounderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout allowedRoles={["FOUNDER"]}>
      {children}
    </DashboardLayout>
  );
}
