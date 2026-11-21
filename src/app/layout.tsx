import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeScript } from "@/components/theme";
import { Toaster } from "@/components/action-form";
import { PWASetup } from "@/components/pwa";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Gráfica Lima — Cursos presenciais de informática", template: "%s · Gráfica Lima" },
  description:
    "Cursos presenciais de informática e tecnologia com turmas reduzidas, professores dedicados e certificado verificável. Matrícula online, Pix e cartão.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/images/logo.jpeg", apple: "/images/logo.jpeg" },
  appleWebApp: { capable: true, title: "Gráfica Lima", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#07585B" },
    { media: "(prefers-color-scheme: dark)", color: "#102D2D" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <ThemeScript />
        {children}
        <Toaster />
        <PWASetup />
      </body>
    </html>
  );
}