// سرور استاتیک سبک برای نسخه وب (همان خروجی که داخل APK هم هست)
const outDir = new URL("../out/", import.meta.url).pathname;
const indexHtml = await Bun.file(outDir + "index.html").text();

Bun.serve({
  port: Number(process.env.PORT || 3000),
  hostname: process.env.HOSTNAME || "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = Bun.file(outDir + path.slice(1));
    if (await file.exists()) {
      return new Response(file);
    }
    // fallback به index (برای مسیرهای SPA)
    return new Response(indexHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
});
console.log("static server ready on port " + (process.env.PORT || 3000));
