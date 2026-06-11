import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from '@/lib/theme'
import { initLocale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL('https://auditavto.ru'),
  title: {
    default: "AuditAvto — контроль автопарка и фотофиксация",
    template: "%s | AuditAvto",
  },
  description:
    "Система контроля автопарка: фотоосмотры автомобилей, фиксация дефектов, пробега и ДТП, чек-листы и история состояния техники.",
  applicationName: "AuditAvto",
  authors: [{ name: "AuditAvto" }],
  creator: "AuditAvto",
  publisher: "AuditAvto",
  category: "Управление автопарком",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  verification: {
    google: "dnDRiRU-y_kYIh4rvD1gLYTjK-fPQK9ZjX6PW2nsGDg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/brand/favicon.svg",
    shortcut: "/brand/favicon.svg",
    apple: "/auditavto/icon.png",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "AuditAvto",
    url: "/",
    title: "AuditAvto — контроль автопарка и фотофиксация",
    description:
      "Фотоосмотры автомобилей, дефекты, пробег, ДТП и история состояния техники в единой системе.",
    images: [
      {
        url: "/auditavto/009.png",
        width: 1200,
        height: 630,
        alt: "AuditAvto — цифровой контроль автопарка",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AuditAvto — контроль автопарка и фотофиксация",
    description:
      "Фотоосмотры автомобилей, дефекты, пробег, ДТП и история состояния техники в единой системе.",
    images: ["/auditavto/009.png"],
  },
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
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=109752087','ym');

            ym(109752087,'init',{
              ssr:true,
              webvisor:true,
              clickmap:true,
              ecommerce:'dataLayer',
              referrer:document.referrer,
              url:location.href,
              accurateTrackBounce:true,
              trackLinks:true
            });
          `}
        </Script>
        <noscript
          dangerouslySetInnerHTML={{
            __html: '<div><img src="https://mc.yandex.ru/watch/109752087" style="position:absolute;left:-9999px" alt="" /></div>',
          }}
        />
      </body>
    </html>
  );
}
