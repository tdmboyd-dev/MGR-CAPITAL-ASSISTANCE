"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineHandler() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("You're back online", {
        icon: <Wifi className="h-4 w-4" />,
        duration: 3000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You're offline. Some features may not work.", {
        icon: <WifiOff className="h-4 w-4" />,
        duration: Infinity,
        id: "offline-toast",
      });
    };

    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 md:hidden">
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-destructive text-destructive-foreground text-sm font-medium shadow-lg">
        <WifiOff className="h-4 w-4" />
        Offline
      </div>
    </div>
  );
}
