// ─── تولید فایل اکسل (xlsx) کاملاً آفلاین — بدون هیچ کتابخانه خارجی ───
// xlsx = ZIP از XML. اینجا ZIP به روش «بدون فشرده‌سازی» (stored) ساخته می‌شود که
// فرمت استاندارد ZIP است و اکسل/لیبره‌آفیس/گوگل‌شیت آن را باز می‌کنند.
// خالص و قابل‌تست — خروجی: Uint8Array

// ─── CRC-32 (IEEE 802.3) جدولی ───
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const te = new TextEncoder();

// ─── ZIP stored ───
interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function u16(arr: number[], v: number): void {
  arr.push(v & 0xff, (v >> 8) & 0xff);
}
function u32(arr: number[], v: number): void {
  arr.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const out: number[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = te.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    // Local file header
    u32(out, 0x04034b50);
    u16(out, 20); // version needed
    u16(out, 0x0800); // flags: UTF-8 names
    u16(out, 0); // method: stored
    u16(out, 0); // time
    u16(out, 0x21); // date (1980-01-01 — ثابت)
    u32(out, crc);
    u32(out, size); // compressed
    u32(out, size); // uncompressed
    u16(out, nameBytes.length);
    u16(out, 0); // extra len
    for (const b of nameBytes) out.push(b);
    for (const b of e.data) out.push(b);

    // Central directory record
    u32(central, 0x02014b50);
    u16(central, 20); // version made by
    u16(central, 20); // version needed
    u16(central, 0x0800);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0x21);
    u32(central, crc);
    u32(central, size);
    u32(central, size);
    u16(central, nameBytes.length);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0);
    u32(central, 0);
    u32(central, offset);
    for (const b of nameBytes) central.push(b);

    offset += 30 + nameBytes.length + size;
  }

  const cdOffset = offset;
  const cdSize = central.length;
  // EOCD — بعد از central directory (چیدمان استاندارد: local entries، central، EOCD)
  const eocd: number[] = [];
  u32(eocd, 0x06054b50);
  u16(eocd, 0);
  u16(eocd, 0);
  u16(eocd, entries.length);
  u16(eocd, entries.length);
  u32(eocd, cdSize);
  u32(eocd, cdOffset);
  u16(eocd, 0);

  const total = new Uint8Array(out.length + central.length + eocd.length);
  total.set(out, 0);
  total.set(central, out.length);
  total.set(eocd, out.length + central.length);
  return total;
}

// ─── XML ───
function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export interface XlsxSheet {
  name: string;
  rows: (string | number)[][];
  colWidths?: number[];
}

function sheetXml(sheet: XlsxSheet): string {
  const col = (n: number): string => {
    // 1 → A, 27 → AA
    let s = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const parts: string[] = [XML_DECL];
  parts.push(
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
  );
  parts.push('<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>');
  parts.push('<sheetFormatPr defaultRowHeight="18"/>');
  if (sheet.colWidths && sheet.colWidths.length > 0) {
    parts.push("<cols>");
    sheet.colWidths.forEach((w, i) => {
      parts.push(`<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`);
    });
    parts.push("</cols>");
  }
  parts.push("<sheetData>");
  sheet.rows.forEach((row, ri) => {
    parts.push(`<row r="${ri + 1}">`);
    row.forEach((cell, ci) => {
      const ref = `${col(ci + 1)}${ri + 1}`;
      if (typeof cell === "number" && Number.isFinite(cell)) {
        parts.push(`<c r="${ref}"${ri === 0 ? ' s="1"' : ""}><v>${cell}</v></c>`);
      } else if (cell === null || cell === undefined) {
        return; // سلول خالی
      } else {
        parts.push(`<c r="${ref}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEsc(String(cell))}</t></is></c>`);
      }
    });
    parts.push("</row>");
  });
  parts.push("</sheetData></worksheet>");
  return parts.join("");
}

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const entries: ZipEntry[] = [];

  entries.push({
    name: "[Content_Types].xml",
    data: te.encode(
      XML_DECL +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_s, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join("") +
        "</Types>"
    ),
  });

  entries.push({
    name: "_rels/.rels",
    data: te.encode(
      XML_DECL +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>"
    ),
  });

  entries.push({
    name: "xl/workbook.xml",
    data: te.encode(
      XML_DECL +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets
          .map(
            (s, i) =>
              `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
          )
          .join("") +
        "</sheets></workbook>"
    ),
  });

  entries.push({
    name: "xl/_rels/workbook.xml.rels",
    data: te.encode(
      XML_DECL +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (_s, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
          )
          .join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        "</Relationships>"
    ),
  });

  // استایل مینیمال: فونت ۲ = بولد (سرستون‌ها)
  entries.push({
    name: "xl/styles.xml",
    data: te.encode(
      XML_DECL +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border/></borders>' +
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
        '<cellXfs count="2"><xf xfId="0"/><xf fontId="1" xfId="0" applyFont="1"/></cellXfs>' +
        "</styleSheet>"
    ),
  });

  sheets.forEach((s, i) => {
    entries.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: te.encode(sheetXml(s)) });
  });

  return buildZip(entries);
}
