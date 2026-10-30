"use client";

import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider,useAuthStore } from "@/hooks/useAuth";
import i18n from "@/i18n";
import { QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect,useState,type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => useAuthStore.subscribe((current, previous) => {
    if (current.user?.id !== previous.user?.id || current.user?.role !== previous.user?.role) {
      void queryClient.cancelQueries();
      queryClient.clear();
    }
  }), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <I18nextProvider i18n={i18n}>
          <AuthProvider>{children}</AuthProvider>
        </I18nextProvider>
      </ThemeProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
