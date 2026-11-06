// การคำนวณขนาดป้าย: แปลงหน่วย อัตราส่วน ขนาดพิกเซลของไฟล์งาน และความสูงตัวอักษรตามระยะมองเห็น

import { UNITS } from './constants.js';

export function toCm(value, unit) {
  const u = UNITS[unit];
  if (!u) throw new Error(`ไม่รู้จักหน่วย: ${unit}`);
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n * u.toCm;
}

// ค่ากว้าง/สูงสูงสุดที่เก็บได้ในหน่วยใดก็ได้ (เท่ากับ normalizeProject ใน project-model.js)
export const SIZE_VALUE_MAX = 100000;

/**
 * แปลงความยาวระหว่างหน่วย โดยขนาดจริงคงเดิม — คลาดเคลื่อนไม่เกิน 0.001 มม.
 * ใช้ทศนิยมที่สั้นที่สุดที่ยังอยู่ในเกณฑ์นี้ (300 ซม. → 3 ม. · 0.75 ม. → 75 ซม. · 100 ซม. → 39.3701 นิ้ว → 100 ซม.)
 * จึงเปลี่ยนหน่วยไปมากี่ครั้งตัวเลขก็ไม่คลาดเคลื่อนสะสม
 * ค่าว่าง ศูนย์ ติดลบ หรือไม่ใช่ตัวเลข → null (ผู้เรียกคงค่าเดิมไว้ ไม่ทำให้ข้อมูลหาย)
 */
export function convertLength(value, from, to) {
  const a = UNITS[from];
  const b = UNITS[to];
  if (!a || !b) throw new Error(`ไม่รู้จักหน่วย: ${a ? to : from}`);
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (from === to) return n;
  const exact = (n * a.toCm) / b.toCm;
  const tolerance = 0.0001 / b.toCm; // 0.001 มม. ในหน่วยปลายทาง
  for (let d = 0; d <= 6; d += 1) {
    const r = Number(exact.toFixed(d));
    if (Math.abs(r - exact) <= tolerance) return r;
  }
  return Number(exact.toFixed(6));
}

/**
 * เปลี่ยนหน่วยของขนาดป้าย { width, height, unit } — แปลงตัวเลขทั้งสองด้าน ขนาดจริงคงเดิม
 * ด้านที่ว่าง/ไม่ถูกต้อง คงค่าเดิม · ถ้าแปลงแล้วเกินที่เก็บได้ → ไม่เปลี่ยนหน่วย (ok: false)
 * @returns {{ ok: true, size: { width: number, height: number, unit: string } } | { ok: false, error: string }}
 */
export function convertSize({ width, height, unit }, to) {
  const out = { width, height, unit: to };
  for (const key of ['width', 'height']) {
    const c = convertLength(out[key], unit, to);
    if (c == null) continue;
    if (c > SIZE_VALUE_MAX) return { ok: false, error: `เปลี่ยนเป็น${UNITS[to].label}ไม่ได้ — ตัวเลขจะเกิน ${SIZE_VALUE_MAX.toLocaleString('en-US')} (ขนาดใหญ่เกินที่รองรับ)` };
    out[key] = c;
  }
  return { ok: true, size: out };
}

export function formatNumber(n, digits = 1) {
  if (!Number.isFinite(n)) return '-';
  const fixed = Number(n.toFixed(digits));
  return fixed.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// คืนอัตราส่วนอย่างง่าย เช่น 120×240 → "1:2"; ถ้าเป็นเลขไม่ลงตัวใช้ทศนิยม เช่น "1:1.41"
export function aspectRatio(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0 && h > 0)) return '-';
  const sw = Math.round(w * 100);
  const sh = Math.round(h * 100);
  const g = gcd(sw, sh);
  const a = sw / g;
  const b = sh / g;
  if (a <= 50 && b <= 50) return `${a}:${b}`;
  return w >= h ? `${formatNumber(w / h, 2)}:1` : `1:${formatNumber(h / w, 2)}`;
}

export function orientation(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0 && h > 0)) return 'unknown';
  if (Math.abs(w - h) / Math.max(w, h) < 0.02) return 'square';
  return w > h ? 'landscape' : 'portrait';
}

export const ORIENTATION_LABELS = {
  landscape: 'แนวนอน',
  portrait: 'แนวตั้ง',
  square: 'จัตุรัส',
  unknown: '-',
};

// ความละเอียดที่แนะนำ: ป้ายยิ่งใหญ่ยิ่งมองจากไกล จึงใช้ dpi ต่ำลงได้
export function recommendedDpi(widthCm, heightCm) {
  const longest = Math.max(widthCm, heightCm);
  if (longest <= 60) return 300;
  if (longest <= 150) return 150;
  if (longest <= 500) return 100;
  return 50;
}

export function pixelSize(widthCm, heightCm, dpi) {
  const toPx = (cm) => Math.round((cm / 2.54) * dpi);
  return { width: toPx(widthCm), height: toPx(heightCm) };
}

// หลักทั่วไป: ตัวอักษรสูง 1 นิ้ว อ่านได้ดีที่ระยะ 10 ฟุต (≈ 0.83 ซม. ต่อระยะ 1 เมตร)
export function minLetterHeightCm(viewingDistanceM) {
  const d = Number(viewingDistanceM);
  if (!(d > 0)) return 0;
  return (d * 2.54) / 3.048;
}

// สรุปข้อมูลขนาดทั้งหมดในครั้งเดียว ใช้ทั้งในหน้าจอและการสร้าง Prompt
export function describeSize({ width, height, unit }) {
  const wCm = toCm(width, unit);
  const hCm = toCm(height, unit);
  if (!(wCm > 0 && hCm > 0)) return null;
  const dpi = recommendedDpi(wCm, hCm);
  const px = pixelSize(wCm, hCm, dpi);
  const o = orientation(wCm, hCm);
  return {
    widthCm: wCm,
    heightCm: hCm,
    areaSqm: (wCm * hCm) / 10000,
    ratio: aspectRatio(wCm, hCm),
    orientation: o,
    orientationLabel: ORIENTATION_LABELS[o],
    dpi,
    px,
  };
}
