"use client";

import { DashboardLayout } from "@/components/DashboardLayout";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout allowedRoles={["CLIENT", "ADMIN", "FOUNDER"]}>
      {children}
    </DashboardLayout>
  );
}
