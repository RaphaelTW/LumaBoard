import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LumaBoard — Painéis ambientes, sem distrações",
  description:
    "Central local-first para criar, programar e compartilhar painéis em e-paper, e-readers e qualquer navegador.",
  applicationName: "LumaBoard",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
