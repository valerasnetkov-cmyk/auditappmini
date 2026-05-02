import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from '@/lib/theme'
import { initLocale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Аудит Техники",
  description: "Система независимой фотофиксации состояния техники",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (typeof window !== 'undefined') {
    initLocale()
  }
  
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
