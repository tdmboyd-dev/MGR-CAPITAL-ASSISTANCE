"use client";

import { DashboardLayout } from "@/components/DashboardLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout allowedRoles={["ADMIN", "FOUNDER"]}>
      {children}
    </DashboardLayout>
  );
}
