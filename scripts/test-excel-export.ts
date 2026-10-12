// تست‌های تولید xlsx آفلاین — bun scripts/test-excel-export.ts
// ساختار ZIP (stored) و XML شیت از پایه اعتبارسنجی می‌شود + CRC هر ورودی بازبینی می‌شود
import { buildXlsx, crc32 } from "../src/lib/excel-export";

let pass = 0;
let failCount = 0;
function ok(cond: boolean, label: string): void {
  if (cond) {
    pass++;
  } else {
    failCount++;
    console.error(`✗ ${label}`);
  }
}
function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) pass++;
  else {
    failCount++;
    console.error(`✗ ${label}\n  انتظار: ${e}\n  واقعی:  ${a}`);
  }
}

const bytes = buildXlsx([
  {
    name: "تراکنش‌ها",
    rows: [
      ["تاریخ", "ساعت", "نوع", "عنوان", "بابت", "مبلغ", "دسته"],
      ["1404/07/20", "05:24", "برداشت", "هزینه", "خرید ماهانه خواربار", 47300, "خواربار"],
      ["1404/07/20", "05:07", "واریز", "درآمد", "حقوق آبان", 5000000, "درآمد"],
    ],
    colWidths: [12, 8, 9, 16, 22, 14, 14],
  },
]);

// ─── امضای ZIP ───
ok(bytes[0] === 0x50 && bytes[1] === 0x4b, "امضای ZIP (PK)");

// ─── EOCD و تعداد ورودی‌ها ───
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
let eocd = -1;
for (let i = bytes.length - 22; i >= 0; i--) {
  if (view.getUint32(i, true) === 0x06054b50) {
    eocd = i;
    break;
  }
}
ok(eocd >= 0, "EOCD پیدا شد");
const entryCount = view.getUint16(eocd + 10, true);
eq(entryCount, 6, "۶ ورودی (content-types، rels، workbook، workbook-rels، styles، sheet1)");
const cdOffset = view.getUint32(eocd + 16, true);
const cdSize = view.getUint32(eocd + 12, true);
ok(cdOffset + cdSize === eocd, "central directory دقیقاً قبل از EOCD است");

// ─── خواندن local headers و اعتبارسنجی CRC و محتوا ───
function readEntry(offset: number): { name: string; data: Uint8Array; headerEnd: number } {
  ok(view.getUint32(offset, true) === 0x04034b50, `local header در ${offset}`);
  const nameLen = view.getUint16(offset + 26, true);
  const extraLen = view.getUint16(offset + 28, true);
  const size = view.getUint32(offset + 18, true);
  const crc = view.getUint32(offset + 14, true);
  const method = view.getUint16(offset + 8, true);
  ok(method === 0, "روش ذخیره بدون فشرده‌سازی");
  const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
  const data = bytes.subarray(offset + 30 + nameLen + extraLen, offset + 30 + nameLen + extraLen + size);
  eq(crc32(data), crc, `CRC درست برای ${name}`);
  return { name, data, headerEnd: offset + 30 + nameLen + extraLen + size };
}

const names: string[] = [];
let off = 0;
for (let i = 0; i < entryCount; i++) {
  const e = readEntry(off);
  names.push(e.name);
  off = e.headerEnd;
}
eq(names, ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"], "نام ورودی‌ها");

// ─── محتوای XML شیت ───
const sheetXml = new TextDecoder().decode(
  (() => {
    let o = 0;
    let out: Uint8Array<ArrayBufferLike> = new Uint8Array();
    for (let i = 0; i < entryCount; i++) {
      const e = readEntry(o);
      if (e.name === "xl/worksheets/sheet1.xml") out = e.data;
      o = e.headerEnd;
    }
    return out;
  })()
);
ok(sheetXml.includes('rightToLeft="1"'), "شیت راست‌به‌چپ");
ok(sheetXml.includes(">تاریخ<"), "سرستون فارسی");
ok(sheetXml.includes("<v>47300</v>"), "مبلغ عددی (نه متن)");
ok(sheetXml.includes("<v>5000000</v>"), "مبلغ درآمد عددی");
ok(sheetXml.includes("خرید ماهانه خواربار"), "متن فارسی سلول");
ok(sheetXml.includes('s="1"'), "استایل بولد سرستون");
ok(!sheetXml.includes("&amp;&"), "XML escape سالم");

// ─── escape ───
const escBytes = buildXlsx([{ name: "S", rows: [["a<b>&\"c\"</b>"]] }]);
ok(new TextDecoder().decode(escBytes).includes("a&lt;b&gt;&amp;&quot;c&quot;&lt;/b&gt;"), "escape کاراکترهای XML");

console.log(`\nنتیجه: ${pass} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
