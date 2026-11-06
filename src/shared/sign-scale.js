// ดึงสเกลจากภาพป้าย (เมนู "ภาพแสดงขนาดป้าย") — ตรรกะล้วน ไม่ใช้ DOM
//
// หลักการ
// - ภาพไม่มีหน่วยจริง: ทุกค่าใน ซม. มาจากสเกล (ซม./พิกเซล) ที่คำนวณจากขนาดที่ผู้ใช้รู้จริง — ไม่มีขนาดอ้างอิง = ไม่แสดง ซม.
// - ขนาดที่ลูกค้ากำหนดสำคัญที่สุด: กรอกครบกว้าง × สูง = ใช้ทันที ไม่ถาม ไม่แก้ ไม่แนะนำขนาดอื่น
//   สเกลแยกแกน — แนวกว้างใช้ ความกว้างจริง ÷ ความกว้างในภาพ (sx) แนวสูงใช้ ความสูงจริง ÷ ความสูงในภาพ (sy)
//   ถ้าสัดส่วนภาพไม่ตรงขนาดจริง แต่ละแกนจึงยังอ้างอิงตัวเลขของลูกค้าเอง (ไม่ยืดภาพ และไม่แก้ตัวเลขของลูกค้า)
// - กรอกด้านเดียว หรืออ้างอิงจากชิ้นที่รู้ขนาด: ใช้สเกลเดียวทั้งสองแกน (sx = sy) และไม่เดาอีกด้านเป็นขนาดจริง
// - ค่าที่คำนวณจากภาพเป็นค่าประมาณเสมอ (≈ … ประมาณ) — ไม่แสดงตัวเลขความคลาดเคลื่อนที่ยังพิสูจน์ไม่ได้
// - ขนาดที่ลูกค้ากำหนด แยกจาก "ทดลองปรับ" (ลองขนาดอ้างอิงอื่น) — ภาพและแบบไม่เปลี่ยน เปลี่ยนเฉพาะตัวเลข

import { computeDimensions, roundCm } from './sign-dimensions.js';

/** ค่าที่ผู้ใช้กำหนด หรือค่าประมาณจากสเกล */
const user = (value) => ({ value, source: 'user' });
const estimated = (px, cmPerPx) => ({ value: roundCm(px * cmPerPx), source: 'estimated' });
// สเกลรับได้ทั้งตัวเลขเดียว (ทั้งสองแกน) หรือ { sx, sy }
const axes = (scale) => (typeof scale === 'number' ? { sx: scale, sy: scale } : { sx: scale?.sx ?? null, sy: scale?.sy ?? null });

/**
 * สเกลจากขนาดป้ายรวม (ช่องกว้าง/สูงที่ลูกค้ากำหนด)
 * @param {{ widthCm: number|null, heightCm: number|null, boxWidth: number, boxHeight: number }} a
 * @returns sx/sy = ซม. ต่อพิกเซลแนวกว้าง/แนวสูง · perAxis = กรอกครบแต่สัดส่วนไม่ตรงภาพ (แต่ละแกนใช้ตัวเลขของตัวเอง)
 */
export function scaleFromSign({ widthCm, heightCm, boxWidth, boxHeight }) {
  const dims = computeDimensions({ widthCm, heightCm, boxWidth, boxHeight });
  if (dims.missing) return { ...dims, sx: null, sy: null, cmPerPx: null, axis: null, refCm: null, perAxis: false };
  const both = dims.width.source === 'user' && dims.height.source === 'user';
  if (both) {
    const sx = dims.width.value / boxWidth;
    const sy = dims.height.value / boxHeight;
    return { ...dims, sx, sy, cmPerPx: sx, axis: 'w', refCm: dims.width.value, perAxis: dims.ratioWarning };
  }
  const axis = dims.width.source === 'user' ? 'w' : 'h';
  const refCm = axis === 'w' ? dims.width.value : dims.height.value;
  const k = refCm / (axis === 'w' ? boxWidth : boxHeight);
  return { ...dims, sx: k, sy: k, cmPerPx: k, axis, refCm, perAxis: false };
}

/**
 * สเกลจากชิ้นที่รู้ขนาด (เช่น โลโก้กว้าง 60 ซม.) — ขนาดป้ายรวมกลายเป็นค่าประมาณ
 * @param {{ refCm: number|null, refPx: number, boxWidth: number, boxHeight: number }} a
 */
export function scaleFromItem({ refCm, refPx, boxWidth, boxHeight }) {
  if (!(refCm > 0) || !(refPx > 0)) {
    return { width: { value: null, source: 'none' }, height: { value: null, source: 'none' }, missing: true, sx: null, sy: null, cmPerPx: null, axis: null, refCm: null, ratioWarning: false, perAxis: false };
  }
  const cmPerPx = refCm / refPx;
  return { width: estimated(boxWidth, cmPerPx), height: estimated(boxHeight, cmPerPx), missing: false, sx: cmPerPx, sy: cmPerPx, cmPerPx, axis: 'item', refCm, ratioWarning: false, perAxis: false, imageRatio: boxWidth / boxHeight };
}

/**
 * ทดลองปรับ: ลองค่าอ้างอิงอื่นแทนค่าที่ลูกค้ากำหนด (เช่น ลูกค้าขอ 300 ซม. แต่หน้างานได้ 240 ซม.)
 * ทุกค่าคูณด้วยอัตราส่วนเดียวกัน — ค่าอ้างอิงที่ผู้ใช้พิมพ์เป็นค่าที่กำหนด ค่าอื่นเป็นค่าประมาณ
 * @returns {null | { factor, cmPerPx, refCm }}
 */
export function trialScale(scale, trialCm) {
  if (!scale || scale.missing || !(trialCm > 0) || !(scale.refCm > 0)) return null;
  const factor = trialCm / scale.refCm;
  return { factor, sx: scale.sx * factor, sy: scale.sy * factor, cmPerPx: scale.sx * factor, refCm: trialCm };
}

/** ขนาดป้ายรวมในโหมดทดลองปรับ — ด้านอ้างอิงเป็นค่าที่พิมพ์ ด้านอื่นปรับตามอัตราส่วนเดียวกัน (ค่าประมาณ) */
export function trialSignDims(scale, trial, boxWidth, boxHeight) {
  if (!trial) return null;
  const est = (side, px) => {
    const base = scale[side];
    // ค่าที่ลูกค้ากำหนดปรับตามอัตราส่วน (ไม่ใช่ค่าที่ลูกค้าให้แล้ว จึงเป็นค่าประมาณ)
    return base.source === 'user' ? { value: roundCm(base.value * trial.factor), source: 'estimated' } : estimated(px, side === 'width' ? trial.sx : trial.sy);
  };
  return {
    width: scale.axis === 'w' ? user(trial.refCm) : est('width', boxWidth),
    height: scale.axis === 'h' ? user(trial.refCm) : est('height', boxHeight),
  };
}

/**
 * ขนาดของกรอบวัดหนึ่งกรอบจากสเกล (ค่าประมาณ)
 * ref = { axis: 'w'|'h', cm } เมื่อกรอบนี้คือชิ้นอ้างอิง → ด้านนั้นเป็นค่าที่ผู้ใช้กำหนด
 */
export function measureBox(box, scale, ref = null) {
  const { sx, sy } = axes(scale);
  if (!(sx > 0) || !(sy > 0)) return { width: { value: null, source: 'none' }, height: { value: null, source: 'none' } };
  return {
    width: ref?.axis === 'w' ? user(ref.cm) : estimated(box.width, sx),
    height: ref?.axis === 'h' ? user(ref.cm) : estimated(box.height, sy),
  };
}

// ---------------------------------------------------------------- จัดกรอบให้พอดีกับองค์ประกอบ

const near = (rgba, p, c, tol) => Math.max(Math.abs(rgba[p * 4] - c[0]), Math.abs(rgba[p * 4 + 1] - c[1]), Math.abs(rgba[p * 4 + 2] - c[2])) <= tol;

/**
 * หดกรอบที่ผู้ใช้ลากคร่าว ๆ ให้ชิดองค์ประกอบจริง (ผู้ใช้ปรับแก้ด้วยมือได้เสมอ)
 * พื้นรอบองค์ประกอบ = ส่วนโปร่งใส/พื้นหลังที่ลบ หรือ "สีพื้นป้าย" ที่ขอบกรอบส่วนใหญ่เป็นสีเดียวกัน
 * dropCut: ชิ้นที่กรอบตัดผ่านและอยู่ในกรอบไม่ถึงครึ่ง (เช่น ใบไม้เหนือตัว É ที่ผู้ใช้ลากกรอบใต้ใบไม้
 * หรือตัวอักษรข้างเคียงที่ล้ำเข้ามานิดเดียว) ไม่นับ — วัดได้เฉพาะส่วนที่ตั้งใจครอบ
 * @returns {null | {x,y,width,height}} null = หาองค์ประกอบในกรอบไม่ได้ (ใช้กรอบเดิม)
 */
export function tightenBox(rgba, w, h, box, { mask = null, tolerance = 40, alphaThreshold = 24, minSpeck = 4, dropCut = true } = {}) {
  const x0 = Math.max(0, Math.round(box.x));
  const y0 = Math.max(0, Math.round(box.y));
  const x1 = Math.min(w, Math.round(box.x + box.width));
  const y1 = Math.min(h, Math.round(box.y + box.height));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw < 2 || bh < 2) return null;
  const empty = (p) => (mask && mask[p]) || rgba[p * 4 + 3] < alphaThreshold;
  // สีพื้นป้ายจากขอบกรอบ: ใช้เมื่อพิกเซลขอบที่ไม่ว่างส่วนใหญ่ (≥ 60%) สีใกล้กัน
  const edge = [];
  for (let x = x0; x < x1; x += 1) edge.push(y0 * w + x, (y1 - 1) * w + x);
  for (let y = y0 + 1; y < y1 - 1; y += 1) edge.push(y * w + x0, y * w + x1 - 1);
  const solid = edge.filter((p) => !empty(p));
  let face = null;
  if (solid.length >= edge.length * 0.5) {
    const med = [0, 1, 2].map((c) => {
      const v = solid.map((p) => rgba[p * 4 + c]).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    });
    if (solid.filter((p) => near(rgba, p, med, tolerance)).length >= solid.length * 0.6) face = med;
  }
  const fgAt = (p) => !empty(p) && !(face && near(rgba, p, face, tolerance));
  const sub = new Uint8ClampedArray(bw * bh * 4);
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      if (fgAt((y0 + y) * w + x0 + x)) sub[(y * bw + x) * 4 + 3] = 255;
    }
  }
  // ชิ้นที่แตะขอบกรอบ: นับพิกเซลของทั้งชิ้น (รวมส่วนนอกกรอบ) — นับถึงสองเท่าของส่วนในกรอบก็พอรู้ว่าอยู่ในกรอบไม่ถึงครึ่ง
  const mostlyOutside = (cells, inside) => {
    const seen = new Set(cells);
    const stack = [...cells];
    let total = cells.length;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (seen.has(q) || !fgAt(q)) continue;
          seen.add(q);
          total += 1;
          if (total > inside * 2) return true;
          stack.push(q);
        }
      }
    }
    return false;
  };
  const keep = dropCut
    ? (comp) => !comp.touchesEdge || !mostlyOutside(comp.cells.map((c) => (y0 + Math.floor(c / bw)) * w + x0 + (c % bw)), comp.cells.length)
    : () => true;
  const found = boundsOf(sub, bw, bh, minSpeck, keep);
  return found ? { x: x0 + found.x, y: y0 + found.y, width: found.width, height: found.height } : null;
}

// ขอบเขตของพิกเซลทึบ ตัดจุดรบกวนเล็ก ๆ (ส่วนที่ติดกัน 8 ทิศไม่เกิน minSpeck พิกเซล) และชิ้นที่ keep() ไม่รับ
function boundsOf(rgba, w, h, minSpeck, keep = () => true) {
  const seen = new Uint8Array(w * h);
  let bx0 = w;
  let by0 = h;
  let bx1 = -1;
  let by1 = -1;
  for (let s = 0; s < w * h; s += 1) {
    if (seen[s] || !rgba[s * 4 + 3]) continue;
    const stack = [s];
    seen[s] = 1;
    let size = 0;
    let cx0 = w;
    let cy0 = h;
    let cx1 = -1;
    let cy1 = -1;
    const cells = [];
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      size += 1;
      cells.push(p);
      if (x < cx0) cx0 = x;
      if (x > cx1) cx1 = x;
      if (y < cy0) cy0 = y;
      if (y > cy1) cy1 = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) {
            const q = ny * w + nx;
            if (!seen[q] && rgba[q * 4 + 3]) {
              seen[q] = 1;
              stack.push(q);
            }
          }
        }
      }
    }
    if (size <= minSpeck) continue;
    if (!keep({ cells, touchesEdge: cx0 === 0 || cy0 === 0 || cx1 === w - 1 || cy1 === h - 1 })) continue;
    bx0 = Math.min(bx0, cx0);
    by0 = Math.min(by0, cy0);
    bx1 = Math.max(bx1, cx1);
    by1 = Math.max(by1, cy1);
  }
  return bx1 < 0 ? null : { x: bx0, y: by0, width: bx1 - bx0 + 1, height: by1 - by0 + 1 };
}

// ---------------------------------------------------------------- รายการเส้นวัดจากกรอบวัด

/**
 * เส้นวัดทั้งหมดของภาพ: ขนาดป้ายรวม (กว้างด้านล่าง สูงด้านซ้าย) + กรอบวัดแต่ละส่วนตามด้านที่ผู้ใช้เลือก
 * @param {{ sign: { box, showW, showH, wLabel, hLabel }, items: Array<{ id, box, showW, showH, wSide, hSide, wLabel, hLabel }>, image: {width,height} }} a
 * @returns {{ crop: {x,y,width,height}, dims: Array }} crop = พื้นที่ภาพที่ใส่ในไฟล์ (ป้าย + ทุกกรอบวัด)
 */
export function buildDims({ sign, items = [], image }) {
  const boxes = [sign.box, ...items.map((i) => i.box)];
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)));
  const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)));
  const x1 = Math.min(image.width, Math.max(...boxes.map((b) => b.x + b.width)));
  const y1 = Math.min(image.height, Math.max(...boxes.map((b) => b.y + b.height)));
  const crop = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  const dims = [];
  const add = (id, b, showW, showH, wSide, hSide, wLabel, hLabel, overall = false) => {
    // ขนาดรวมของป้ายวัดที่ขอบภาพผลลัพธ์ · กรอบภายในวัดจากขอบของกรอบเอง (เส้นประนำสายตาลากผ่านภาพ)
    if (showW && wLabel) dims.push({ id, axis: 'w', side: wSide, from: b.x, to: b.x + b.width, edge: overall ? (wSide === 'top' ? y0 : y1) : wSide === 'top' ? b.y : b.y + b.height, label: wLabel, overall });
    if (showH && hLabel) dims.push({ id, axis: 'h', side: hSide, from: b.y, to: b.y + b.height, edge: overall ? (hSide === 'left' ? x0 : x1) : hSide === 'left' ? b.x : b.x + b.width, label: hLabel, overall });
  };
  add('sign', sign.box, sign.showW, sign.showH, 'bottom', 'left', sign.wLabel, sign.hLabel, true);
  for (const it of items) add(it.id, it.box, it.showW, it.showH, it.wSide === 'bottom' ? 'bottom' : 'top', it.hSide === 'right' ? 'right' : 'left', it.wLabel, it.hLabel);
  return { crop, dims };
}

// ---------------------------------------------------------------- จัดวางเส้นวัดหลายรายการ

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ประมาณความยาวข้อความ (px) — ใช้จัดช่องไม่ให้ตัวเลขทับกัน
export function estimateLabelWidth(text, font) {
  let n = 0;
  for (const ch of text) n += /[ัิ-ฺ็-๎]/.test(ch) ? 0 : /[0-9.≈ ]/.test(ch) ? 0.56 : 0.62;
  return Math.ceil(n * font);
}

/**
 * ตำแหน่งเส้นวัดทุกเส้น (ทุกด้านอยู่นอกพื้นที่ภาพป้าย — ภาพป้ายวางแบบ 1:1 ไม่ทับ)
 * เส้นวัดด้านเดียวกันที่ช่วงไม่ทับกันใช้แถวเดียวกัน (วัดต่อเนื่อง เช่น 86.7 · 5.2 · 77.5)
 * ถ้าทับกันขยับออกไปแถวถัดไป — เส้นที่สั้นกว่าอยู่ใกล้ภาพมากกว่า (เช่น 57 อยู่ใน 100)
 *
 * @param {{ crop: {x,y,width,height}, dims: Array<{ id, side: 'top'|'bottom'|'left'|'right', from, to, edge, label }>, notes?: string[] }} a
 *   from/to = ช่วงตามแนวเส้นวัด และ edge = ขอบกรอบด้านที่หันไปทางเส้นวัด (พิกัดภาพเดิม)
 *   notes = หมายเหตุประเภทขนาดใต้ภาพ (เช่น ขนาดประมาณ) — ไม่มีหมายเหตุ = ภาพมีแค่ป้าย เส้น ลูกศร และตัวเลข
 */
export function measureLayout({ crop, dims, notes = [] }) {
  const base = Math.max(crop.width, crop.height);
  const stroke = clamp(Math.round(base / 350), 2, 8);
  const font = clamp(Math.round(base * 0.045), 18, 96);
  const gap = stroke * 2 + 2;
  const offset = Math.round(font * 0.9);
  const margin = Math.round(font * 0.6);
  const labelPad = Math.round(font * 0.5);

  // ตัวเลขด้านซ้าย/ขวา: แนวนอนข้างลูกศร (อ่านง่ายแม้บรรทัดเตี้ย) — ค่าประมาณแยก "(ประมาณ)" เป็นบรรทัดที่สอง
  const sideLines = (label) => {
    const i = label.indexOf(' (');
    return i > 0 ? [label.slice(0, i), label.slice(i + 1)] : [label];
  };

  // จัดแถว: เส้นสั้นก่อน แล้วใส่แถวแรกที่ไม่ทับ (นับขนาดตัวเลขด้วย)
  const lanes = { top: [], bottom: [], left: [], right: [] };
  const placed = [];
  for (const d of [...dims].sort((a, b) => (a.to - a.from) - (b.to - b.from))) {
    const vertical = d.side === 'left' || d.side === 'right';
    const lines = vertical ? sideLines(d.label) : [d.label];
    const len = d.to - d.from;
    // ความยาวที่ตัวเลขใช้ตามแนวเส้นวัด: บน/ล่าง = ความกว้างข้อความ · ซ้าย/ขวา = ความสูงของข้อความ
    const alongAt = (f) => (vertical ? lines.length * Math.round(f * 1.15) : Math.max(...lines.map((l) => estimateLabelWidth(l, f))));
    // ช่วงสั้น (เช่น บรรทัดเตี้ย ระยะห่าง) ย่อตัวเลขลงได้ถึง 60% ให้พอดีเส้นวัด
    let size = font;
    if (alongAt(font) > len) size = Math.max(14, Math.round(font * Math.max(0.6, len / alongAt(font))));
    const along = alongAt(size);
    const labelW = Math.max(...lines.map((l) => estimateLabelWidth(l, size)));
    let mid = (d.from + d.to) / 2;
    // ตัวเลขไม่ล้นเส้นวัด → ใช้ช่วงของเส้นวัดเอง (วัดต่อเนื่องชิดกันได้) · ล้น → เผื่อระยะห่างตัวเลข
    const half = along <= len ? len / 2 : (along + labelPad) / 2;
    // ตัวเลขที่ยาวกว่าเส้น (เช่น ระยะห่างแคบใกล้มุมภาพ) เลื่อนเข้ามาอยู่ในช่วงของภาพ
    // → ตัวเลขด้านบน/ล่างไม่ล้นเข้ามุมที่เป็นพื้นที่ของตัวเลขด้านซ้าย/ขวา จึงไม่ทับกัน
    const [lo, hi] = vertical ? [crop.y, crop.y + crop.height] : [crop.x, crop.x + crop.width];
    if (half * 2 <= hi - lo) mid = clamp(mid, lo + half, hi - half);
    const span = [mid - half, mid + half];
    const rows = lanes[d.side];
    let k = rows.findIndex((row) => row.spans.every(([a, b]) => span[1] <= a || span[0] >= b));
    if (k < 0) {
      rows.push({ spans: [], thick: 0 });
      k = rows.length - 1;
    }
    rows[k].spans.push(span);
    // ความหนาของแถว (ระยะออกจากภาพ): บน/ล่าง = ความสูงตัวเลข · ซ้าย/ขวา = ความกว้างตัวเลขที่ยาวที่สุด
    rows[k].thick = Math.max(rows[k].thick, vertical ? labelW + Math.round(font * 0.5) : Math.round(size * 1.5));
    placed.push({ ...d, labelMid: mid, lane: k, lines, fontSize: size, lineHeight: Math.round(size * 1.15) });
  }
  // ระยะจากขอบภาพถึงเส้นวัดของแต่ละแถว
  const laneDist = (side, k) => gap + offset + lanes[side].slice(0, k).reduce((s, r) => s + r.thick + Math.round(font * 0.5), 0);
  const depth = (side) => {
    const rows = lanes[side];
    return (rows.length ? laneDist(side, rows.length - 1) + rows[rows.length - 1].thick : gap) + margin;
  };
  const pad = { top: depth('top'), bottom: depth('bottom'), left: depth('left'), right: depth('right') };
  // หมายเหตุใต้ภาพ: ตัวอักษรเล็กกว่าตัวเลข อยู่ใต้เส้นวัดทั้งหมด — ภาพแคบขยายความกว้าง canvas ให้อ่านได้ครบ (ไม่ย่อจนอ่านไม่ออก)
  const noteFont = clamp(Math.round(font * 0.55), 14, 48);
  const noteLine = Math.round(noteFont * 1.45);
  const noteWidth = notes.length ? Math.max(...notes.map((n) => estimateLabelWidth(n, noteFont))) : 0;
  const notesHeight = notes.length ? notes.length * noteLine + margin : 0;
  const image = { x: pad.left, y: pad.top };
  // พิกัดภาพเดิม → พิกัดภาพผลลัพธ์
  const X = (x) => image.x + (x - crop.x);
  const Y = (y) => image.y + (y - crop.y);
  const out = placed.map((d) => {
    const dist = laneDist(d.side, d.lane);
    if (d.side === 'top' || d.side === 'bottom') {
      const lineY = d.side === 'top' ? image.y - dist : image.y + crop.height + dist;
      return { ...d, horizontal: true, x1: X(d.from), x2: X(d.to), y: lineY, extFrom: Y(d.edge), ...(d.edge1 != null ? { ext1: Y(d.edge1), ext2: Y(d.edge2) } : {}), labelX: X(d.labelMid), labelY: d.side === 'top' ? lineY - Math.round(font * 0.3) : lineY + Math.round(font * 0.3) };
    }
    const lineX = d.side === 'left' ? image.x - dist : image.x + crop.width + dist;
    return { ...d, horizontal: false, y1: Y(d.from), y2: Y(d.to), x: lineX, extFrom: X(d.edge), ...(d.edge1 != null ? { ext1: X(d.edge1), ext2: X(d.edge2) } : {}), labelX: d.side === 'left' ? lineX - Math.round(font * 0.35) : lineX + Math.round(font * 0.35), labelY: Y(d.labelMid) };
  });
  const width = Math.max(pad.left + crop.width + pad.right, noteWidth + margin * 2);
  const height = pad.top + crop.height + pad.bottom + notesHeight;
  return {
    canvas: { width, height },
    image,
    notes: notes.map((text, i) => ({ text, x: margin, y: pad.top + crop.height + pad.bottom + i * noteLine, fontSize: noteFont })),
    stroke,
    font,
    gap,
    arrowHead: stroke * 4 + 4,
    dims: out,
  };
}
