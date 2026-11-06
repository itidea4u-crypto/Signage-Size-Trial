// ภาพแสดงขนาดป้าย: คำนวณจาก "ส่วนที่ยืนยันขนาดจริง" — ตรรกะล้วน ไม่ใช้ DOM
//
// หลัก
// - ผู้ใช้ลากกรอบรอบส่วนที่รู้ขนาดจริง แล้วกรอกด้านที่รู้ (กว้าง สูง หรือทั้งคู่) → ส่วนนั้น "ยืนยันแล้ว"
// - ส่วนหลัก (mainId) = ส่วนที่ใช้คำนวณส่วนอื่นทั้งหมด — ผู้ใช้เลือก/ส่วนแรกที่ยืนยัน ระบบไม่เปลี่ยนเอง
// - ส่วนที่ยืนยันใช้ตัวเลขที่ผู้ใช้กรอกเสมอ (ไม่ถูกคำนวณทับ) · ด้านที่ไม่ได้กรอกคำนวณจากส่วนหลัก (ค่าประมาณ)
// - ภาพไม่ได้สัดส่วนเดียวกับแบบผลิต (เช่น ภาพจาก AI) → แจ้งเตือน แต่ไม่แก้ตัวเลขที่ยืนยัน
// - สเกลของส่วนหลัก: กรอกด้านเดียว → สเกลเดียวทั้งสองแกน · กรอกครบ → แยกแกน (เหมือนขนาดป้ายที่ลูกค้ากำหนด)

import { roundCm } from './sign-dimensions.js';
import { measureBox } from './sign-scale.js';

// ต่างกันเกินนี้ = แจ้งเตือน (ภาพกับแบบไม่ตรงกัน หรือกรอบรวมส่วนที่ไม่ได้วัดในแบบ)
export const MISMATCH_PCT = 5;

const user = (value) => ({ value, source: 'user' });
const pctDiff = (a, b) => (Math.abs(a - b) / b) * 100;

/**
 * สเกลจากส่วนหลัก
 * @param {{ box: {width,height}, wCm: number|null, hCm: number|null }} part
 * @returns {{ missing: true } | { missing: false, sx, sy, axis: 'w'|'h', refCm, perAxis: boolean }}
 */
export function scaleFromPart(part) {
  const w = part?.wCm > 0 ? part.wCm : null;
  const h = part?.hCm > 0 ? part.hCm : null;
  const b = part?.box;
  if (!b || !(b.width > 0) || !(b.height > 0) || (!w && !h)) return { missing: true, sx: null, sy: null, axis: null, refCm: null, perAxis: false };
  if (w && h) return { missing: false, sx: w / b.width, sy: h / b.height, axis: 'w', refCm: w, perAxis: true };
  const k = w ? w / b.width : h / b.height;
  return { missing: false, sx: k, sy: k, axis: w ? 'w' : 'h', refCm: w || h, perAxis: false };
}

/**
 * ขนาดของทุกส่วน
 * @param {{
 *   parts: Array<{ id: string, box: {x,y,width,height}, wCm?: number|null, hCm?: number|null, sources?: { w?: string, h?: string } }>,
 *   mainId: string,
 *   trialCm?: number|null,
 * }} a  wCm/hCm = ขนาดที่ยืนยัน (null = ไม่ได้กรอก) · sources = ประเภทของด้านที่ยืนยัน (ค่าเริ่มต้น user)
 * @returns {{
 *   missing: boolean, main: object|null, scale: object, trial: object|null,
 *   sizes: Record<string, { width: {value,source}, height: {value,source} }>,
 *   warnings: Array<{ code: 'main-ratio'|'mismatch', id: string, axis?: 'w'|'h', imageCm?: number, confirmedCm?: number, pct: number }>,
 * }}
 */
export function measureParts({ parts, mainId, trialCm = null }) {
  const main = parts.find((p) => p.id === mainId && (p.wCm > 0 || p.hCm > 0)) || null;
  const scale = scaleFromPart(main);
  const empty = { width: { value: null, source: 'none' }, height: { value: null, source: 'none' } };
  if (scale.missing) {
    return { missing: true, main: null, scale, trial: null, sizes: Object.fromEntries(parts.map((p) => [p.id, empty])), warnings: [] };
  }
  // ทดลองปรับ: ด้านอ้างอิงของส่วนหลักเป็นค่าที่พิมพ์ ทุกค่าอื่นคูณอัตราส่วนเดียวกัน (เป็นค่าประมาณ)
  const factor = trialCm > 0 ? trialCm / scale.refCm : null;
  const trial = factor ? { factor, sx: scale.sx * factor, sy: scale.sy * factor, refCm: trialCm, axis: scale.axis } : null;
  const sizes = {};
  for (const p of parts) {
    const est = measureBox(p.box, trial || scale);
    const side = (key, cm, axis) => {
      if (!(cm > 0)) return est[key];
      if (trial) return p === main && axis === trial.axis ? user(trialCm) : { value: roundCm(cm * factor), source: 'estimated' };
      return { value: cm, source: p.sources?.[axis] || 'user' };
    };
    sizes[p.id] = { width: side('width', p.wCm, 'w'), height: side('height', p.hCm, 'h') };
  }
  // ตรวจความสอดคล้อง (ไม่แก้ตัวเลขใด ๆ — แจ้งเตือนอย่างเดียว)
  const warnings = [];
  if (main.wCm > 0 && main.hCm > 0) {
    const pct = pctDiff(main.wCm / main.hCm, main.box.width / main.box.height);
    if (pct > MISMATCH_PCT) warnings.push({ code: 'main-ratio', id: main.id, pct });
  }
  for (const p of parts) {
    if (p === main) continue;
    for (const [axis, cm, px, k] of [['w', p.wCm, p.box.width, scale.sx], ['h', p.hCm, p.box.height, scale.sy]]) {
      if (!(cm > 0)) continue;
      const imageCm = px * k;
      const pct = pctDiff(imageCm, cm);
      if (pct > MISMATCH_PCT) warnings.push({ code: 'mismatch', id: p.id, axis, imageCm: roundCm(imageCm), confirmedCm: cm, pct });
    }
  }
  return { missing: false, main, scale, trial, sizes, warnings };
}

/**
 * ส่วนหลักหลังผู้ใช้ยกเลิกการยืนยันส่วนหลักเดิม: ส่วนที่ยืนยันลำดับแรกที่เหลือ (แจ้งผู้ใช้เสมอ)
 * — ไม่ใช้เมื่อยืนยันส่วนอื่นเพิ่ม (ส่วนหลักไม่เปลี่ยนเอง)
 */
export function nextMainId(parts, removedId) {
  return parts.find((p) => p.id !== removedId && (p.wCm > 0 || p.hCm > 0))?.id || '';
}
