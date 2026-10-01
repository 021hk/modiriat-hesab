import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: "مدیریت حساب | حساب‌یار",
  description:
    "نرم‌افزار مدیریت حساب، هزینه، بدهکاران و طلبکاران با اتصال پیامک بانکی - قابل نصب روی اندروید، ویندوز، مک و لینوکس",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  applicationName: "حساب‌یار",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "حساب‌یار",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: 'Vazirmatn';
                src: url('/fonts/Vazirmatn-Light.woff2') format('woff2');
                font-weight: 300;
                font-display: swap;
              }
              @font-face {
                font-family: 'Vazirmatn';
                src: url('/fonts/Vazirmatn-Regular.woff2') format('woff2');
                font-weight: 400;
                font-display: swap;
              }
              @font-face {
                font-family: 'Vazirmatn';
                src: url('/fonts/Vazirmatn-Medium.woff2') format('woff2');
                font-weight: 500;
                font-display: swap;
              }
              @font-face {
                font-family: 'Vazirmatn';
                src: url('/fonts/Vazirmatn-Bold.woff2') format('woff2');
                font-weight: 700;
                font-display: swap;
              }
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
        <SwRegister />
      </body>
    </html>
  );
}
