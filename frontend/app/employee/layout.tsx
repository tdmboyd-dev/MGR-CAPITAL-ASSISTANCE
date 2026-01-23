"use client";

import { DashboardLayout } from "@/components/DashboardLayout";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout allowedRoles={["EMPLOYEE", "ADMIN", "FOUNDER"]}>
      {children}
    </DashboardLayout>
  );
}
