"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useEffect, useState } from "react";

interface ServiceWorkerState {
  isSupported: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

export function useServiceWorker() {
  const hydrated = useHydrated();
  const online = useOnlineStatus();
  const supported = hydrated && "serviceWorker" in navigator;
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isInstalled: false,
    isOffline: false,
    registration: null,
    updateAvailable: false,
  });

  useEffect(() => {
    // Check if service workers are supported
    const isSupported = "serviceWorker" in navigator;


    if (!isSupported) return;

    let updateTimer: ReturnType<typeof setInterval> | undefined;
    let disposed = false;

    // Register service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (disposed) return;

        setState((prev) => ({
          ...prev,
          isInstalled: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setState((prev) => ({ ...prev, updateAvailable: true }));
              }
            });
          }
        });

        // Check for updates periodically (every 60 minutes)
        updateTimer = setInterval(() => {
          void registration.update().catch(() => undefined);
        }, 60 * 60 * 1000);
      } catch (error) {
        console.error("[SW] Registration failed:", error);
      }
    };

    registerSW();

    return () => {
      disposed = true;
      if (updateTimer) clearInterval(updateTimer);

    };
  }, []);

  // Force update the service worker
  const updateServiceWorker = async () => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
  };

  // Request push notification permission
  const requestPushPermission = async (): Promise<PushSubscription | null> => {
    if (!("PushManager" in window)) {
      console.warn("[SW] Push notifications not supported");
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("[SW] Push permission denied");
        return null;
      }

      if (!state.registration) {
        console.warn("[SW] No service worker registration");
        return null;
      }

      // Get VAPID public key from environment
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn("[SW] VAPID public key not configured");
        return null;
      }

      const subscription = await state.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });


      return subscription;
    } catch (error) {
      console.error("[SW] Push subscription failed:", error);
      return null;
    }
  };

  // Queue offline request for background sync
  const queueOfflineRequest = async (...requests: [{
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
  }]) => {
    void requests;
    throw new Error("Offline changes are unavailable. Reconnect and submit while signed in; no request or credentials were stored.");
  };

  return {
    ...state,
    isSupported: supported,
    isOffline: !online,
    updateServiceWorker,
    requestPushPermission,
    queueOfflineRequest,
  };
}

// Helper: Convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
