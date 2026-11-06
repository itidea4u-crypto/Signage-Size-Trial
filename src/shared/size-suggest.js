// ขนาดแนะนำ (เมนูทางเลือก) — ใช้เฉพาะเมื่อพนักงานกดขอเอง และลูกค้ายังไม่ได้กำหนดขนาด
// ระบบไม่แสดงขนาดแนะนำเอง และไม่แสดงเมื่อมีขนาดจากลูกค้าแล้วแม้เพียงด้านเดียว (ดู canSuggestSize)
// ไม่ใช้ AI: คำนวณจากพื้นที่ติดตั้งที่พนักงานรู้ + ระยะเว้นขอบ + สัดส่วนของภาพป้าย และอธิบายที่มาได้ทุกบรรทัด
// ผลลัพธ์เป็น "ขนาดแนะนำ" เสมอ — ไม่ใช่ขนาดจริง พนักงานกด "ใช้ขนาดนี้" เองจึงจะนำไปกรอก

import { formatLength } from './sign-dimensions.js';

export const SUGGEST_MARGIN_PCT = 10;
const STEP_CM = 5;

/** แสดงเมนูขนาดแนะนำได้เมื่อยังไม่มีขนาดจริงครบทั้งกว้างและสูง */
// ลูกค้าให้ขนาดมาแล้ว (ด้านใดด้านหนึ่ง) → ห้ามแนะนำ: "ใช้ขนาดนี้" จะเขียนทับตัวเลขของลูกค้า
export function canSuggestSize({ widthCm, heightCm }) {
  return !(widthCm > 0) && !(heightCm > 0);
}

/**
 * @param {{ areaWidthCm: number|null, areaHeightCm: number|null, marginPct?: number, imageRatio: number, unit?: string }} a
 *   imageRatio = กว้าง/สูง ของกรอบป้ายในภาพ (ใช้คงสัดส่วนงานออกแบบ)
 * @returns {{ ok: true, width: number, height: number, limitedBy: 'width'|'height', basis: string[] } | { ok: false, error: string }}
 */
export function suggestSignSize({ areaWidthCm, areaHeightCm, marginPct = SUGGEST_MARGIN_PCT, imageRatio, unit = 'cm' }) {
  const W = areaWidthCm > 0 ? areaWidthCm : null;
  const H = areaHeightCm > 0 ? areaHeightCm : null;
  if (!(imageRatio > 0)) return { ok: false, error: 'ต้องมีภาพป้ายก่อน — ใช้สัดส่วนของภาพในการประเมิน' };
  if (!W && !H) return { ok: false, error: 'กรอกความกว้างหรือความสูงของพื้นที่ติดตั้งอย่างน้อย 1 ค่า' };
  const m = Math.min(40, Math.max(0, Number(marginPct) || 0));
  const usableW = W ? W * (1 - (2 * m) / 100) : Infinity;
  const usableH = H ? H * (1 - (2 * m) / 100) : Infinity;
  // ป้ายใหญ่ที่สุดที่ใส่ในพื้นที่ได้ โดยคงสัดส่วนของภาพ
  const limitedBy = usableW / imageRatio <= usableH ? 'width' : 'height';
  let width = limitedBy === 'width' ? usableW : usableH * imageRatio;
  // ปัดลงทีละ 5 ซม. (ไม่เกินพื้นที่) แล้วคำนวณอีกด้านตามสัดส่วน
  width = Math.max(STEP_CM, Math.floor(width / STEP_CM) * STEP_CM);
  const height = Math.round(width / imageRatio);
  const L = (cm) => `${formatLength(cm, unit)} ${unit === 'cm' ? 'ซม.' : unit === 'm' ? 'ม.' : unit === 'mm' ? 'มม.' : 'นิ้ว'}`;
  const basis = [
    `พื้นที่ติดตั้ง: ${W ? `กว้าง ${L(W)}` : ''}${W && H ? ' × ' : ''}${H ? `สูง ${L(H)}` : ''}`,
    `เว้นขอบรอบป้าย ${m}% ต่อด้าน`,
    `คงสัดส่วนของภาพป้าย (กว้าง:สูง ≈ ${imageRatio.toFixed(2)}:1)`,
    `ความกว้างปัดลงทีละ ${STEP_CM} ซม. ความสูงคำนวณตามสัดส่วน`,
  ];
  return { ok: true, width, height, limitedBy, basis };
}
