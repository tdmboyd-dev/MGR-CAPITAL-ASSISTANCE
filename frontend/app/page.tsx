"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const { user, accessToken, isHydrated } = useAuth();

  useEffect(() => {
    if(!isHydrated)return;
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
  }, [user, accessToken, isHydrated, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
