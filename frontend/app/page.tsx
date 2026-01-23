"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { user, accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) {
      router.replace("/auth/login");
      return;
    }

    // Redirect based on user role
    if (user) {
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
  }, [user, accessToken, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
