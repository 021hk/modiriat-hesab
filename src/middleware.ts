import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * میدل‌ور رفع باگ «صفحه سیاه اندروید»:
 * برای هر ناوبری سند (document navigation) دو هدر حیاتی تنظیم می‌شود:
 *
 * 1) Clear-Site-Data: هر کش قدیمی (Service Worker نسخه‌های قبل، CacheStorage،
 *    HTTP cache و HTML کهنه‌ای که با oklch خراب رندر می‌شد) روی گوشی کاربر
 *    به‌صورت خودکار پاک می‌شود و اولین بازلودِ موفق، دستگاه را «خودترمیم» می‌کند.
 *    (برنامه هیچ داده‌ای در localStorage/IndexedDB/کوکی نگه نمی‌دارد — داده‌ها
 *    سمت سرور در SQLite هستند، پس این پاک‌سازی بی‌خطر است.)
 *
 * 2) Cache-Control: no-store — HTML هرگز نباید در پروکسی/مرورگر کش شود؛
 *    قبلاً s-maxage=31536000 (کش یک‌ساله!) داشت که ریشه HTML کهنه بود.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // تشخیص ناوبری سند: هدر sec-fetch-dest (مرورگرهای مدرن) یا accept: text/html (بقیه)
  // (request.mode در سمت سرور قابل اتکا نیست)
  const secFetchDest = request.headers.get("sec-fetch-dest");
  const accept = request.headers.get("accept") || "";
  const isDocument =
    secFetchDest === "document" || (!secFetchDest && accept.includes("text/html"));

  if (isDocument) {
    response.headers.set("Clear-Site-Data", '"cache", "storage"');
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    response.headers.set("X-Hesab-Yar-Version", "1.2.0");
  }

  return response;
}

export const config = {
  // فقط مسیرهای اپ؛ فایل‌های استاتیک که هش دارند مستثنا هستند
  matcher: [
    "/((?!_next/static|_next/image|fonts/|icon|sw.js|manifest.json|favicon.ico).*)",
  ],
};
