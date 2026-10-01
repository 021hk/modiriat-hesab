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
  viewportFit: "cover",
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
        {/* اسپلش بوت: تا زمان بارگذاری کامل جاوااسکریپت نمایش داده می‌شود */}
        <div
          id="boot-splash"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            backgroundColor: "#f0fdf4",
            fontFamily: "Vazirmatn, sans-serif",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(225deg, #10b981, #065f46)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(5,150,105,.35)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#065f46" }}>حساب‌یار</div>
          <div
            style={{
              width: 28,
              height: 28,
              border: "3px solid #a7f3d0",
              borderTopColor: "#059669",
              borderRadius: "50%",
              animation: "bootspin 0.8s linear infinite",
            }}
          />
          <noscript>
            <p style={{ color: "#065f46", fontSize: 13, padding: "0 24px", textAlign: "center" }}>
              برای استفاده از برنامه، جاوااسکریپت را در مرورگر فعال کنید.
            </p>
          </noscript>
          <style>{`@keyframes bootspin{to{transform:rotate(360deg)}}`}</style>
          {/* اطمینان: اگر جاوااسکریپت با خطا مواجه شد، اسپلش بعد از ۱۵ ثانیه حذف می‌شود */}
          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(function(){var s=document.getElementById('boot-splash');if(s)s.parentNode&&s.parentNode.removeChild(s)},15000);`,
            }}
          />
        </div>
        {children}
        <Toaster />
        <SwRegister />
      </body>
    </html>
  );
}
