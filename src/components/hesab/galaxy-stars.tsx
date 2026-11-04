"use client";
// ─── پس‌زمینهٔ کهکشانی (v2.14.3) ───
// با تم «کهکشانی» فعال می‌شود: ستاره‌های ریز چشمک‌زن + سحابی‌های شناور +
// شهاب گاه‌به‌گاه. رنگ ستاره‌ها از رنگ تم (متغیرهای --orb-*) پیروی می‌کند.
// فقط سمت کلاینت و بعد از mount رندر می‌شود (بدون اختلاف hydration).

import { useEffect, useMemo, useState } from "react";

/** مولد شبه‌تصادفی با دانهٔ ثابت — چیدمان ستاره‌ها در هر اجرا یکسان می‌ماند */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  left: string;
  top: string;
  size: number;
  delay: string;
  dur: string;
  color: string;
  glow: boolean;
}

export function GalaxyStars() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const check = () => setActive(document.documentElement.getAttribute("data-special") === "kahkeshani");
    check();
    window.addEventListener("hesab-theme-change", check);
    return () => window.removeEventListener("hesab-theme-change", check);
  }, []);

  const stars = useMemo<Star[]>(() => {
    if (!active) return [];
    const rnd = mulberry32(20261103);
    const list: Star[] = [];
    for (let i = 0; i < 130; i++) {
      const accent = rnd() < 0.34; // حدود یک‌سوم ستاره‌ها به رنگ تم
      const big = rnd() < 0.08; // چند ستارهٔ درشت درخشان
      list.push({
        left: `${(rnd() * 100).toFixed(2)}%`,
        top: `${(rnd() * 100).toFixed(2)}%`,
        size: big ? 2.6 + rnd() * 1.6 : 0.8 + rnd() * 1.5,
        delay: `${(rnd() * 5).toFixed(2)}s`,
        dur: `${(1.8 + rnd() * 3.4).toFixed(2)}s`,
        color: accent ? "var(--orb-hi, #e7eaf6)" : rnd() < 0.5 ? "#ffffff" : "#c9d4ff",
        glow: big,
      });
    }
    return list;
  }, [active]);

  if (!active) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* سحابی‌های رنگی شناور */}
      <div
        className="absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, var(--orb-deep, #1a2248) 0%, transparent 70%)",
          filter: "blur(38px)",
          animation: "hy-drift 14s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, var(--orb-mid, #27315e) 0%, transparent 70%)",
          filter: "blur(46px)",
          animation: "hy-drift 19s ease-in-out 2s infinite reverse",
        }}
      />
      {/* ستاره‌های چشمک‌زن */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            boxShadow: s.glow ? `0 0 ${s.size * 3}px ${s.size}px color-mix(in srgb, ${s.color} 55%, transparent)` : undefined,
            animation: `hy-twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}
      {/* شهاب — هر ۹ ثانیه یک بار */}
      <span
        className="absolute left-full top-[12%] h-px w-40"
        style={{
          background: "linear-gradient(to left, rgba(255,255,255,0.9), transparent)",
          animation: "hy-shoot 9s linear 3s infinite",
        }}
      />
    </div>
  );
}
