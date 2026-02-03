"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Redirect inbox to messages page for consistency
export default function ClientInboxRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/client/messages");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Redirecting to messages...</p>
      </div>
    </div>
  );
}
