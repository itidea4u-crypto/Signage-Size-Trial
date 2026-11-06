// คำนวณขนาดไฟล์ภาพสำหรับงานพิมพ์ (จำนวนพิกเซล) จากขนาดป้ายและความละเอียดเป้าหมาย (PPI)
//
// ตัวเลขที่ได้คือ "เป้าหมายของไฟล์ที่ส่งผลิต" — ไม่ใช่ความละเอียดที่ AI สร้างภาพได้จริง
// ภาพจาก AI สร้างภาพโดยทั่วไปมีขนาดราว 1,000–2,000 px ต่อด้าน จึงมักต้องเตรียมไฟล์เพิ่ม (เช่น ทำในโปรแกรมออกแบบ หรือขยายภาพ)
//
// ระบบสีเป้าหมายของงานพิมพ์คือ CMYK — โปรแกรมไม่ได้แปลงสีให้ ภาพจาก ChatGPT เป็น RGB
// ทีมกราฟิกต้องแปลงเป็น CMYK ใน Photoshop ตามโปรไฟล์สีของเครื่องพิมพ์และวัสดุก่อนผลิต

import { UNITS } from './constants.js';

// ตัวเลือกที่กดได้ทันที — ผู้ใช้กำหนดค่าอื่นเองได้ (PPI_MIN–PPI_MAX)
export const PPI_OPTIONS = [72, 100, 150, 200, 300];
// ค่าเริ่มต้นของโครงการใหม่ตามคำแนะนำของทีมกราฟิก (เวอร์ชันก่อน 0.2.0 ใช้ 100 — โครงการที่บันทึกค่าไว้แล้วใช้ค่าเดิม)
export const DEFAULT_PPI = 150;
// ป้ายบิลบอร์ดที่มองไกลมากอาจใช้ต่ำถึง 10–30 PPI · งานพิมพ์ทั่วไปไม่เกิน 1,200 PPI
export const PPI_MIN = 10;
export const PPI_MAX = 1200;

export const PRINT_COLOR_TARGET = 'CMYK';

// ขนาดด้านยาวที่ AI สร้างภาพได้โดยตรงโดยประมาณ — เกินนี้ต้องเตรียมไฟล์เพิ่มก่อนผลิต
export const AI_MAX_SIDE_PX = 2048;
// ด้านยาวเกินนี้ โปรแกรมแต่งภาพทั่วไปเปิด/บันทึกแบบปกติไม่ได้ (เช่น ไฟล์ PSD จำกัด 30,000 px)
export const HUGE_SIDE_PX = 30000;

const CM_PER_INCH = 2.54;

// ค่าที่บันทึกในโครงการ: จำนวนเต็มในช่วงที่ใช้ได้ (ไม่จำกัดเฉพาะตัวเลือก) — ไม่มีค่า/ค่าผิด ใช้ค่าเริ่มต้น
export function normalizePpi(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= PPI_MIN && n <= PPI_MAX ? n : DEFAULT_PPI;
}

/**
 * ตรวจค่า PPI ที่ผู้ใช้พิมพ์เอง — รับเลขไทย เครื่องหมายจุลภาค และคำว่า PPI/DPI ต่อท้ายได้
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
export function parsePpiInput(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))
    .replace(/,/g, '')
    .replace(/\s*(?:ppi|dpi)$/i, '')
    .trim();
  if (!s) return { ok: false, error: 'กรอกความละเอียดเป็นตัวเลข เช่น 150' };
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(s)) return { ok: false, error: 'ใส่ได้เฉพาะตัวเลข เช่น 150' };
  const n = Number(s);
  if (n <= 0) return { ok: false, error: 'ความละเอียดต้องเป็นตัวเลขที่มากกว่า 0' };
  if (!Number.isInteger(n)) return { ok: false, error: 'ใส่เป็นจำนวนเต็ม เช่น 150' };
  if (n < PPI_MIN) return { ok: false, error: `ต่ำเกินไป — ใส่อย่างน้อย ${PPI_MIN} PPI` };
  if (n > PPI_MAX) return { ok: false, error: `สูงเกินไป — ใส่ไม่เกิน ${formatPx(PPI_MAX)} PPI` };
  return { ok: true, value: n };
}

// แปลงความยาวเป็นนิ้ว — หน่วยนิ้วใช้ค่าตรง ไม่ผ่านเซนติเมตร เพื่อไม่ให้เกิดเศษทศนิยมสะสม
function toInches(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !UNITS[unit]) return 0;
  return unit === 'in' ? n : (n * UNITS[unit].toCm) / CM_PER_INCH;
}

/**
 * @param {{ width: number, height: number, unit: string, targetPpi?: number }} brief
 * @returns {null | {
 *   ppi: number, widthIn: number, heightIn: number, widthCm: number, heightCm: number,
 *   px: { width: number, height: number }, megapixels: number, rgbMB: number,
 *   level: 'ok' | 'over-ai' | 'huge'
 * }} null = ยังไม่ได้กรอกขนาดป้าย จึงคำนวณไม่ได้ (ไม่ใช้ขนาดสมมติ)
 */
export function printFileSpec(brief) {
  const widthIn = toInches(brief.width, brief.unit);
  const heightIn = toInches(brief.height, brief.unit);
  if (!(widthIn > 0 && heightIn > 0)) return null;
  const ppi = normalizePpi(brief.targetPpi);
  const px = { width: Math.round(widthIn * ppi), height: Math.round(heightIn * ppi) };
  const longest = Math.max(px.width, px.height);
  const megapixels = (px.width * px.height) / 1e6;
  return {
    ppi,
    widthIn,
    heightIn,
    widthCm: widthIn * CM_PER_INCH,
    heightCm: heightIn * CM_PER_INCH,
    px,
    megapixels,
    // ขนาดไฟล์แบบไม่บีบอัด (8 บิตต่อช่องสี) — ไฟล์จริงมักเล็กกว่านี้เมื่อบีบอัด
    rgbMB: (px.width * px.height * 3) / (1024 * 1024),
    cmykMB: (px.width * px.height * 4) / (1024 * 1024),
    level: longest > HUGE_SIDE_PX ? 'huge' : longest > AI_MAX_SIDE_PX ? 'over-ai' : 'ok',
  };
}

export function formatPx(n) {
  return Math.round(n).toLocaleString('en-US');
}
