import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import { FeedbackButton } from "@/components/FeedbackButton";
import { VoiceAiButton } from "@/components/VoiceAiButton";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MGR Capital Assistance",
  description: "Sovereign Surplus & Tax Sale Recovery Platform",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors />
        <FeedbackButton />
        <VoiceAiButton />
      </body>
    </html>
  );
}
