// ─── تقویم جلالی (الگوریتم jalaali-js — خالص و بدون وابستگی) ───
// برای: انتخابگر تاریخ/ساعت تراکنش، مرز «این ماه» در آمار داشبورد
// سال جلالی = سال میلادی − ۶۲۱ (تقریبی)، نوروز معمولاً ۲۰/۲۱ مارس

function div(a: number, b: number): number {
  return ~~(a / b);
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

interface JalCalResult {
  leap: number;
  gy: number;
  march: number;
}

function jalCal(jy: number): JalCalResult {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324,
    2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;
  if (jy < jp || jy >= breaks[bl - 1]) throw new Error("سال جلالی نامعتبر: " + jy);
  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

// روز جولیَن از تاریخ میلادی
function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

// تاریخ میلادی از روز جولیَن
function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

// تاریخ جلالی از روز جولیَن
function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

// روز جولیَن از تاریخ جلالی
function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd));
}

export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd));
}

export function isLeapJalaliYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

// تاریخ ISO → جلالی (بر اساس زمان محلی دستگاه)
export function isoToJalali(iso: string): JalaliDate {
  const d = new Date(iso);
  return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// آغاز ماه جلالی جاری و ماه قبل به‌صورت Date محلی — برای مرز آمار «این ماه» داشبورد
export function jalaliMonthBounds(now: Date = new Date()): { currentStart: Date; prevStart: Date } {
  const j = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const pj = j.jm === 1 ? { jy: j.jy - 1, jm: 12 } : { jy: j.jy, jm: j.jm - 1 };
  const cur = toGregorian(j.jy, j.jm, 1);
  const prev = toGregorian(pj.jy, pj.jm, 1);
  return {
    currentStart: new Date(cur.gy, cur.gm - 1, cur.gd, 0, 0, 0, 0),
    prevStart: new Date(prev.gy, prev.gm - 1, prev.gd, 0, 0, 0, 0),
  };
}

// تاریخ + ساعت محلی → جلالی (برای انتخابگر)
export function dateToJalaliParts(d: Date): JalaliDate & { hour: number; minute: number } {
  return {
    ...toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

// جلالی + ساعت → ISO (زمان محلی)
export function jalaliPartsToIso(jy: number, jm: number, jd: number, hour: number, minute: number): string {
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd, hour, minute, 0, 0).toISOString();
}
