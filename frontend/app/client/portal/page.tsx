"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Redirect portal to dashboard - the portal page now redirects to the main client dashboard
export default function ClientPortalRedirect() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Redirect to client dashboard
    router.replace("/client/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
