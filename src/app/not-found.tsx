import Link from "next/link";

/**
 * صفحه ۴۰۴ — با پس‌زمینه روشن (صفحه پیش‌فرض Next سیاه است).
 * داخل root layout رندر می‌شود، پس اسپلش بوت بعد از hydration حذف خواهد شد.
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        fontFamily: "Vazirmatn, Tahoma, sans-serif",
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 700, color: "#059669" }}>۴۰۴</div>
      <h1 style={{ fontSize: 18, margin: 0, color: "#0e1913" }}>
        صفحه پیدا نشد
      </h1>
      <p style={{ fontSize: 14, color: "#4b6357", margin: 0 }}>
        آدرسی که باز کرده‌اید وجود ندارد.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          background: "#059669",
          color: "#ffffff",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 700,
          padding: "10px 28px",
          borderRadius: 10,
          marginTop: 8,
        }}
      >
        بازگشت به برنامه
      </Link>
    </div>
  );
}
