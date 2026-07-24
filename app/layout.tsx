import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWAProvider } from "./pwa-manager";
import { ThemeController } from "./theme-controller";
import { AppErrorBoundary } from "./error-boundary";

export const metadata: Metadata = {
  title: "LumaBoard — Painéis ambientes, sem distrações",
  description: "Central local-first para criar, programar e compartilhar painéis em e-paper, e-readers e qualquer navegador.",
  applicationName: "LumaBoard",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "LumaBoard" },
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], shortcut: "/favicon.svg", apple: "/icons/icon-192.png" },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = { themeColor: "#35513a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-startup-image" href="/icons/splash-750x1334.png" media="(device-width: 375px) and (device-height: 667px)" />
        <link rel="apple-touch-startup-image" href="/icons/splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px)" />
        <link rel="apple-touch-startup-image" href="/icons/splash-2048x2732.png" media="(min-device-width: 768px)" />
      </head>
      <body>
        <PWAProvider>
          <ThemeController />
          <AppErrorBoundary>{children}</AppErrorBoundary>
        </PWAProvider>
      </body>
    </html>
  );
}
