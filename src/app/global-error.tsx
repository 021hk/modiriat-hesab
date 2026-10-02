"use client";

/**
 * صفحه خطای سراسری — با پس‌زمینه روشن.
 * (صفحه خطای پیش‌فرض Next پس‌زمینه سیاه دارد که عامل اصلی «صفحه سیاه» است!)
 * توجه: global-error جایگزین کل root layout می‌شود و باید html/body خودش را داشته باشد.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          backgroundColor: "#f4f8f6",
          color: "#0e1913",
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "24px", maxWidth: 360 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(225deg, #10b981, #065f46)",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(5,150,105,.35)",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
          </div>
          <h1 style={{ fontSize: 18, margin: "0 0 8px", color: "#065f46" }}>
            خطایی رخ داد
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#4b6357",
              margin: "0 0 20px",
              lineHeight: 1.8,
            }}
          >
            مشکلی در اجرای برنامه پیش آمد. لطفاً دوباره تلاش کنید.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#059669",
              color: "#ffffff",
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 28px",
              borderRadius: 10,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
