import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SwRegister } from "@/components/sw-register";
import { ThemeProvider } from "@/components/theme-provider";

// نسخه ۲.۰: برنامه کاملاً آفلاین است — داده‌ها در IndexedDB خود دستگاه ذخیره می‌شوند

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
        <meta name="color-scheme" content="light dark" />
        {/* ثبت سرویس‌ورکر مستقیم در HTML — مستقل از hydration؛ حتی اگر جاوااسکریپت
            صفحه شکست بخورد، SW جدید نصب و کش‌های قدیمی پاک‌سازی می‌شوند */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}}catch(e){}`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html { background-color: #f4f8f6; color-scheme: light; }
              html.dark { background-color: #0b1410; color-scheme: dark; }
              html.dark #boot-splash { background-color: #0b1410 !important; }
              html.dark #boot-splash .boot-text { color: #37b78a !important; }
              body { background-color: #f4f8f6; color: #0e1913; margin: 0; }
              html.dark body { background-color: #0b1410; color: #ecefed; }
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
        <ThemeProvider>
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
          <div className="boot-text" style={{ fontSize: 18, fontWeight: 700, color: "#065f46" }}>حساب‌یار</div>
          <div
            className="boot-spinner"
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
          <div id="boot-error" style={{ display: "none", textAlign: "center", padding: "0 24px" }}>
            <p style={{ color: "#065f46", fontSize: 13, marginBottom: 10 }}>
              بارگذاری بیش از حد طول کشید. اتصال اینترنت را بررسی کنید.
            </p>
            <a
              href="/"
              style={{
                display: "inline-block",
                background: "#059669",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
                padding: "8px 24px",
                borderRadius: 10,
              }}
            >
              تلاش دوباره
            </a>
          </div>
          <style>{`@keyframes bootspin{to{transform:rotate(360deg)}}`}</style>
          {/* اطمینان: اگر برنامه تا ۱۲ ثانیه بالا نیامد، یک‌بار با پارامتر retry=1 رفرش
              می‌شود (از sessionStorage استفاده نمی‌کنیم چون Clear-Site-Data آن را پاک می‌کند
              و باعث حلقه رفرش بی‌نهایت می‌شد)؛ اگر باز هم نشد، پیام خطا نمایش داده می‌شود */}
          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(function(){
                var s=document.getElementById('boot-splash');
                if(!s)return;
                if(location.search.indexOf('retry=1')<0){
                  location.replace(location.pathname+location.search+(location.search?'&':'?')+'retry=1');
                  return;
                }
                var sp=document.querySelector('#boot-splash .boot-spinner');
                if(sp)sp.style.display='none';
                var er=document.getElementById('boot-error');
                if(er)er.style.display='block';
              },12000);`,
            }}
          />
        </div>
        {children}
        <Toaster />
        <SwRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
