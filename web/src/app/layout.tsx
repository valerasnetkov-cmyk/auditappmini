import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from './contexts/ToastContext'

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
  return (
    <html lang="ru">
      <body className="min-h-screen">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
