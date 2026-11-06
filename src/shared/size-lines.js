// ภาพแสดงขนาดป้าย: "วัดทีละเส้น" — ตรรกะล้วน ไม่ใช้ DOM
//
// การวัดหนึ่งครั้ง = เส้นบอกขนาด 1 เส้น (ไม่สร้างกว้าง + สูงพร้อมกัน)
//   { id, type: 'size'|'gap', axis: 'x'|'y', a, b, at, ... }
//   axis x = แนวนอน: a..b = ช่วงพิกัด x · at = พิกัด y ที่ลากเส้น · axis y = แนวตั้ง: a..b = ช่วง y · at = x
//   size = ความกว้าง (x) / ความสูง (y) ของสิ่งที่วัด · gap = ระยะห่างระหว่างสองส่วน
// - เส้นอยู่ตรงที่ผู้ใช้ลากเสมอ — "จับขอบ" เป็นตัวช่วยที่เลือกใช้ (snapMeasure) และย้อนกลับได้
// - สเกล/ขนาดที่ยืนยัน/ส่วนหลัก/คำเตือนใช้ measureParts (src/shared/size-parts.js) ชุดเดิม
// - ภาพที่ส่งออก: เส้นวัดอยู่นอกพื้นที่ป้าย ไม่ทับตัวอักษร · ด้านของเส้นเลือกอัตโนมัติ (ผ่านตัวป้ายน้อยที่สุด)
//   เส้นนำสายตาหยุดที่ขอบของสิ่งที่วัด · ค่าที่คำนวณมี ≈ นำหน้า และมีหมายเหตุรวมใต้ภาพจุดเดียว

import { formatLength, LENGTH_UNITS } from './sign-dimensions.js';

export const MEASURE_TYPES = {
  w: { type: 'size', axis: 'x', label: 'ความกว้าง' },
  h: { type: 'size', axis: 'y', label: 'ความสูง' },
  gap: { type: 'gap', axis: null, label: 'ระยะห่าง' },
};

// กรอบวัด (เครื่องมือหลัก): { id, type: 'box', x, y, w, h, confirm: { raw (กว้าง), rawH (สูง), source }|null,
//   showW, showH (แสดงด้านใดในภาพ — ไม่แสดงทั้งสองด้านเอง), sideW: auto|top|bottom, sideH: auto|left|right, pin, hidden, overall: 'box'|null }
// กรอบใช้เลือกพื้นที่เท่านั้น — ภาพที่ส่งออกไม่มีเส้นกรอบ มีแต่เส้นบอกขนาดด้านที่เลือก
export const isBox = (m) => m?.type === 'box';

export const lineLength = (m) => (isBox(m) ? Math.max(m.w, m.h) : Math.abs(m.b - m.a));
export const measureKindLabel = (m) => (isBox(m) ? 'กรอบ' : m.type === 'gap' ? 'ระยะห่าง' : m.axis === 'x' ? 'ความกว้าง' : 'ความสูง');

/** กรอบจากการลาก (มุมหนึ่ง → มุมตรงข้าม) */
export function boxFromDrag(start, end) {
  const x = Math.round(Math.min(start.x, end.x));
  const y = Math.round(Math.min(start.y, end.y));
  return { type: 'box', x, y, w: Math.max(1, Math.round(Math.max(start.x, end.x)) - x), h: Math.max(1, Math.round(Math.max(start.y, end.y)) - y) };
}

/**
 * ช่วยจับขอบ (กรอบ): หดกรอบให้ชิดตัวป้ายที่อยู่ในกรอบ — ไม่พบตัวป้ายในกรอบ = null (ใช้กรอบตามที่ลาก)
 * @returns {null | { x, y, w, h }}
 */
export function snapBox(img, m) {
  const ink = inkTest(img);
  const x0 = Math.max(0, m.x);
  const y0 = Math.max(0, m.y);
  const x1 = Math.min(img.width, m.x + m.w);
  const y1 = Math.min(img.height, m.y + m.h);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (!ink(x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * "จัดเส้นวัดให้อ่านง่าย": ด้านของเส้นกลับเป็นอัตโนมัติ (ระบบเลือกด้านที่ไม่ทับตัวป้าย)
 * ไม่แตะขนาด ตำแหน่งที่วัด หรือการซ่อน · เส้นที่ผู้ใช้ล็อกตำแหน่ง (pin) ไม่ถูกย้าย
 * @returns {{ measures: Array, moved: number, pinned: number }}
 */
export function arrangeSides(measures) {
  let moved = 0;
  let pinned = 0;
  const out = measures.map((m) => {
    const custom = isBox(m) ? (m.sideW && m.sideW !== 'auto') || (m.sideH && m.sideH !== 'auto') : m.side && m.side !== 'auto';
    if (!custom) return m;
    if (m.pin) {
      pinned += 1;
      return m;
    }
    moved += 1;
    return isBox(m) ? { ...m, sideW: 'auto', sideH: 'auto' } : { ...m, side: 'auto' };
  });
  return { measures: out, moved, pinned };
}

/** ตัวเลขบนภาพ: ขนาดที่ยืนยันแสดงตัวเลขอย่างเดียว · ค่าที่คำนวณมี ≈ นำหน้า (ไม่มีคำว่า "ประมาณ" ซ้ำทุกจุด) */
export function lineLabel(d, unit = 'cm') {
  if (!d || d.value == null) return '';
  const u = LENGTH_UNITS[unit] || LENGTH_UNITS.cm;
  return `${d.source === 'estimated' ? '≈ ' : ''}${formatLength(d.value, unit)} ${u.short}`;
}

/**
 * เส้นจากการลาก: ความกว้าง = เส้นแนวนอนตรง (ตามแนวที่เริ่มลาก) · ความสูง = แนวตั้ง · ระยะห่าง = ตามทิศที่ลากมากกว่า
 * @returns {{ type, axis, a, b, at }}
 */
export function lineFromDrag(tool, start, end) {
  const t = MEASURE_TYPES[tool] || MEASURE_TYPES.w;
  const axis = t.axis || (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'x' : 'y');
  const [s, e, at] = axis === 'x' ? [start.x, end.x, start.y] : [start.y, end.y, start.x];
  return { type: t.type, axis, a: Math.round(Math.min(s, e)), b: Math.round(Math.max(s, e)), at: Math.round(at) };
}

// ---------------------------------------------------------------- จับขอบ (ตัวช่วย)

// พิกเซลที่เป็นตัวป้าย (ไม่ใช่พื้นโปร่งใส/พื้นหลังที่ลบ)
function inkTest({ rgba, width, mask = null, alphaThreshold = 24 }) {
  return (x, y) => {
    const p = y * width + x;
    return rgba[p * 4 + 3] >= alphaThreshold && !(mask && mask[p]);
  };
}

// แปลงพิกัดตามแกนของเส้น: u = ตามแนวเส้น · v = ขวางเส้น
const along = (axis) => (axis === 'x' ? (u, v) => [u, v] : (u, v) => [v, u]);

/**
 * จับขอบ: ความกว้าง/ความสูง → ปลายเส้นชิดขอบนอกของชิ้นที่เส้นลากผ่าน (ทั้งชิ้น เช่น ทั้งตัวอักษร)
 * ระยะห่าง → ช่องว่างที่ยาวที่สุดตามแนวเส้นที่มีตัวป้ายอยู่ทั้งสองข้าง
 * @param {{ rgba, width, height, mask?, alphaThreshold? }} img
 * @returns {null | { a, b, at }} null = ไม่พบตัวป้ายตามแนวเส้น (ใช้เส้นตามที่ลาก)
 */
export function snapMeasure(img, m, { band = 2 } = {}) {
  // ลากผ่านช่องระหว่างตัวอักษรพอดี (ไม่โดนตัวป้าย) → ขยายแถบค้นหาอีกครั้งก่อนถือว่าไม่พบ
  return snapIn(img, m, band) || (m.type === 'gap' ? null : snapIn(img, m, band * 5));
}

function snapIn(img, m, band) {
  const { width: W, height: H } = img;
  const ink = inkTest(img);
  const P = along(m.axis);
  const uMax = m.axis === 'x' ? W : H;
  const vMax = m.axis === 'x' ? H : W;
  const lo = Math.max(0, Math.min(m.a, m.b));
  const hi = Math.min(uMax - 1, Math.max(m.a, m.b));
  const v0 = Math.max(0, m.at - band);
  const v1 = Math.min(vMax - 1, m.at + band);
  const inkAt = (u) => {
    for (let v = v0; v <= v1; v += 1) if (ink(...P(u, v))) return true;
    return false;
  };
  if (m.type === 'gap') {
    // ช่องว่างตามแนวเส้น ที่มีตัวป้ายอยู่ทั้งสองข้าง และซ้อนกับช่วงที่ลาก — เลือกช่องที่ยาวที่สุด
    let best = null;
    let u = 0;
    while (u < uMax) {
      if (inkAt(u)) {
        u += 1;
        continue;
      }
      const s = u;
      while (u < uMax && !inkAt(u)) u += 1;
      const e = u; // ช่องว่าง s..e-1
      const bounded = s > 0 && e < uMax;
      if (bounded && e > lo && s <= hi && (!best || e - s > best.b - best.a)) best = { a: s, b: e };
    }
    return best ? { ...best, at: m.at } : null;
  }
  // ความกว้าง/ความสูง: ชิ้นทั้งหมดที่เส้นลากผ่าน → ขอบเขตรวมตามแนวเส้น
  const t = touched(img, m, band, lo, hi);
  return t ? { a: t.umin, b: t.umax + 1, at: m.at } : null;
}

/**
 * ชิ้นของตัวป้าย (ทั้งชิ้น 8 ทิศ) ที่แถบรอบเส้นช่วง lo..hi แตะ → ขอบเขตรวม
 * u = ตามแนวเส้น · v = ขวางเส้น
 * @returns {null | { umin, umax, vmin, vmax }}
 */
function touched(img, m, band, lo, hi) {
  const { width: W, height: H } = img;
  const ink = inkTest(img);
  const P = along(m.axis);
  const uMax = m.axis === 'x' ? W : H;
  const vMax = m.axis === 'x' ? H : W;
  const u0 = Math.max(0, lo);
  const u1 = Math.min(uMax - 1, hi);
  const v0 = Math.max(0, m.at - band);
  const v1 = Math.min(vMax - 1, m.at + band);
  const seen = new Uint8Array(W * H);
  const r = { umin: Infinity, umax: -Infinity, vmin: Infinity, vmax: -Infinity };
  for (let u = u0; u <= u1; u += 1) {
    for (let v = v0; v <= v1; v += 1) {
      const [x, y] = P(u, v);
      const p = y * W + x;
      if (seen[p] || !ink(x, y)) continue;
      const stack = [p];
      seen[p] = 1;
      while (stack.length) {
        const q = stack.pop();
        const qx = q % W;
        const qy = (q - qx) / W;
        const [qu, qv] = m.axis === 'x' ? [qx, qy] : [qy, qx];
        if (qu < r.umin) r.umin = qu;
        if (qu > r.umax) r.umax = qu;
        if (qv < r.vmin) r.vmin = qv;
        if (qv > r.vmax) r.vmax = qv;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = qx + dx;
            const ny = qy + dy;
            if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const n = ny * W + nx;
            if (!seen[n] && ink(nx, ny)) {
              seen[n] = 1;
              stack.push(n);
            }
          }
        }
      }
    }
  }
  return r.umin === Infinity ? null : r;
}

// ---------------------------------------------------------------- ภาพที่ส่งออก

/** พื้นที่ภาพที่ใส่ในไฟล์: กรอบป้าย + ทุกเส้นวัด */
export function cropOf(signBox, measures, image) {
  const xs = [signBox.x, signBox.x + signBox.width];
  const ys = [signBox.y, signBox.y + signBox.height];
  for (const m of measures) {
    if (isBox(m)) {
      xs.push(m.x, m.x + m.w);
      ys.push(m.y, m.y + m.h);
      continue;
    }
    const [along1, cross] = m.axis === 'x' ? [xs, ys] : [ys, xs];
    along1.push(m.a, m.b);
    cross.push(m.at);
  }
  const x0 = Math.max(0, Math.min(...xs));
  const y0 = Math.max(0, Math.min(...ys));
  const x1 = Math.min(image.width, Math.max(...xs));
  const y1 = Math.min(image.height, Math.max(...ys));
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

// ขอบเขตขวางเส้นของสิ่งที่วัด (ทั้งชิ้นที่เส้นแตะ · ระยะห่าง = สองชิ้นที่อยู่ปลายช่อง) — จำไว้ ไม่คำนวณซ้ำทุกครั้งที่วาด
const rangeCache = new WeakMap();
function objectRange(img, m) {
  const owner = img.mask || img.rgba;
  if (!rangeCache.has(owner)) rangeCache.set(owner, new Map());
  const cache = rangeCache.get(owner);
  const key = `${m.type}|${m.axis}|${m.a}|${m.b}|${m.at}`;
  if (!cache.has(key)) {
    const t = m.type === 'gap'
      ? touched(img, m, 2, m.a - 3, m.b + 2)
      : touched(img, m, 2, m.a, m.b - 1) || touched(img, m, 10, m.a, m.b - 1);
    cache.set(key, t ? { vmin: t.vmin, vmax: t.vmax } : { vmin: m.at, vmax: m.at });
  }
  return cache.get(key);
}

const towardStart = (side) => side === 'top' || side === 'left';

// คะแนนของด้าน (น้อย = ดี): พิกเซลของตัวป้ายอื่นที่เส้นนำสายตาต้องลากผ่านสำคัญที่สุด
// รองลงมา = ความยาวเส้นนำสายตา (ขอบสิ่งที่วัดถึงขอบพื้นที่ภาพ) — เส้นสั้นอ่านง่ายกว่า
function sideCost(img, m, side, crop) {
  const ink = inkTest(img);
  const P = along(m.axis);
  const r = objectRange(img, m);
  const back = towardStart(side);
  const [lo, hi] = m.axis === 'x' ? [crop.y, crop.y + crop.height - 1] : [crop.x, crop.x + crop.width - 1];
  let n = 0;
  for (const u of [Math.min(m.b - 1, m.a + 1), Math.round((m.a + m.b) / 2), Math.max(m.a, m.b - 2)]) {
    if (back) for (let v = r.vmin - 1; v >= lo; v -= 1) n += ink(...P(u, v)) ? 1 : 0;
    else for (let v = r.vmax + 1; v <= hi; v += 1) n += ink(...P(u, v)) ? 1 : 0;
  }
  const reach = back ? r.vmin - lo : hi - r.vmax;
  return n * 100000 + Math.max(0, reach);
}

/** ด้านของเส้นวัดในภาพ: ผู้ใช้เลือกเอง หรืออัตโนมัติ = ด้านที่เส้นนำสายตาผ่านตัวป้ายอื่นน้อยที่สุด แล้วจึงด้านที่เส้นนำสายตาสั้นกว่า */
export function sideOf(img, m, crop) {
  if (m.axis === 'x' && (m.side === 'top' || m.side === 'bottom')) return m.side;
  if (m.axis === 'y' && (m.side === 'left' || m.side === 'right')) return m.side;
  const [s1, s2] = m.axis === 'x' ? ['top', 'bottom'] : ['left', 'right'];
  return sideCost(img, m, s2, crop) < sideCost(img, m, s1, crop) ? s2 : s1;
}

/**
 * รายการเส้นวัดสำหรับ measureLayout
 * @param {object} img ภาพ (rgba, width, height, mask)
 * @param {Array<{ m, label }>} lines เส้นที่แสดงในภาพ พร้อมตัวเลข
 */
export function lineDims(img, lines, crop) {
  const out = [];
  for (const item of lines) {
    const { m } = item;
    if (isBox(m)) {
      out.push(...boxDims(img, item, crop));
      continue;
    }
    const side = sideOf(img, m, crop);
    // เส้นนำสายตาเริ่มที่ขอบนอกของสิ่งที่วัด (ด้านที่หันไปหาเส้นวัด)
    const r = objectRange(img, m);
    const edge = towardStart(side) ? r.vmin : r.vmax + 1;
    out.push({ id: m.id, axis: m.axis === 'x' ? 'w' : 'h', side, from: m.a, to: m.b, edge, edge1: edge, edge2: edge, label: item.label, confirmed: Boolean(item.confirmed) });
  }
  return dedupeDims(out);
}

// ด้านของเส้นบอกขนาดของกรอบ: ผู้ใช้เลือก หรืออัตโนมัติ = ด้านที่เส้นนำสายตาผ่านตัวป้ายน้อยกว่า
// เท่ากัน (เช่น กรอบครอบทั้งป้าย) → ความกว้างด้านล่าง ความสูงด้านซ้าย แบบแบบผลิตทั่วไป
function boxSideOf(img, m, axis, crop) {
  const chosen = axis === 'w' ? m.sideW : m.sideH;
  if (axis === 'w' && (chosen === 'top' || chosen === 'bottom')) return chosen;
  if (axis === 'h' && (chosen === 'left' || chosen === 'right')) return chosen;
  const ink = inkTest(img);
  const cols = (a, len) => [a + Math.round(len * 0.1), a + Math.round(len / 2), a + Math.round(len * 0.9)];
  let before = 0;
  let after = 0;
  if (axis === 'w') {
    for (const x of cols(m.x, m.w - 1)) {
      for (let y = m.y - 1; y >= crop.y; y -= 1) before += ink(x, y) ? 1 : 0;
      for (let y = m.y + m.h; y < crop.y + crop.height; y += 1) after += ink(x, y) ? 1 : 0;
    }
    return before < after ? 'top' : 'bottom';
  }
  for (const y of cols(m.y, m.h - 1)) {
    for (let x = m.x - 1; x >= crop.x; x -= 1) before += ink(x, y) ? 1 : 0;
    for (let x = m.x + m.w; x < crop.x + crop.width; x += 1) after += ink(x, y) ? 1 : 0;
  }
  return after < before ? 'right' : 'left';
}

/** เส้นบอกขนาดของกรอบ: เฉพาะด้านที่ผู้ใช้เลือกแสดง (labelW/labelH ว่าง = ไม่แสดง) · เส้นนำสายตาเริ่มที่ขอบกรอบ */
function boxDims(img, { m, labelW, labelH, confirmedW, confirmedH }, crop) {
  const out = [];
  if (labelW) {
    const side = boxSideOf(img, m, 'w', crop);
    const edge = side === 'top' ? m.y : m.y + m.h;
    out.push({ id: `${m.id}w`, axis: 'w', side, from: m.x, to: m.x + m.w, edge, edge1: edge, edge2: edge, label: labelW, confirmed: Boolean(confirmedW) });
  }
  if (labelH) {
    const side = boxSideOf(img, m, 'h', crop);
    const edge = side === 'left' ? m.x : m.x + m.w;
    out.push({ id: `${m.id}h`, axis: 'h', side, from: m.y, to: m.y + m.h, edge, edge1: edge, edge2: edge, label: labelH, confirmed: Boolean(confirmedH) });
  }
  return out;
}

/**
 * เส้นปะขอบเขตการวัด (บอกลูกค้าว่าขนาดวัดจากตรงไหนถึงตรงไหน) — พิกัดภาพเดิม
 * กรอบ → สี่เหลี่ยมตามกรอบที่ผู้ใช้กำหนด (กรอบซ้อนกันได้) · เส้น → เส้นปะขวางที่ปลายเริ่มต้นและปลายสิ้นสุดของระยะที่วัด
 *   ยาวตลอดสิ่งที่วัด (ไม่สร้างกรอบล้อมทั้งป้ายเอง)
 * @param {Array} items รายการที่แสดงในภาพ ({ m } เหมือน lineDims)
 * @returns {Array<{ kind: 'rect', x, y, w, h } | { kind: 'ends', axis: 'x'|'y', a, b, v1, v2 }>}
 */
export function boundsOf(img, items) {
  const out = [];
  for (const { m } of items) {
    if (isBox(m)) {
      out.push({ kind: 'rect', id: m.id, x: m.x, y: m.y, w: m.w, h: m.h });
      continue;
    }
    const r = objectRange(img, m);
    out.push({ kind: 'ends', id: m.id, axis: m.axis, a: m.a, b: m.b, v1: Math.min(r.vmin, m.at), v2: Math.max(r.vmax + 1, m.at) });
  }
  return out;
}

/**
 * ไม่แสดงเส้นบอกขนาดซ้ำ: ระยะเดียวกัน (แนวเดียวกัน ปลายห่างกันไม่เกิน 0.5% หรือ 2 px) แสดงครั้งเดียว
 * เก็บเส้นที่เป็นขนาดยืนยันไว้ก่อน (ตัวเลขที่ลูกค้าให้มา) ไม่เช่นนั้นเก็บเส้นแรก
 */
export function dedupeDims(dims) {
  const kept = [];
  const order = [...dims.filter((d) => d.confirmed), ...dims.filter((d) => !d.confirmed)];
  for (const d of order) {
    const tol = Math.max(2, (d.to - d.from) * 0.005);
    if (kept.some((k) => k.axis === d.axis && Math.abs(k.from - d.from) <= tol && Math.abs(k.to - d.to) <= tol)) continue;
    kept.push(d);
  }
  // คงลำดับเดิม
  return dims.filter((d) => kept.includes(d));
}

/**
 * เส้นวัด → ส่วนสำหรับ measureParts (สเกลเดียวจากเส้นหลัก · เส้นที่ยืนยันใช้ตัวเลขที่ยืนยัน · คำเตือนเมื่อภาพไม่ตรงแบบ)
 * @param {Array} measures
 * @param {(raw: string) => number|null} toCm อ่านตัวเลขที่ยืนยัน (หน่วยปัจจุบัน → ซม.)
 */
export function measuresAsParts(measures, toCm) {
  const KIND = { customer: 'user', suggested: 'suggested', unknown: 'unknown' };
  return measures.map((m) => {
    if (isBox(m)) {
      // กรอบ: กรอกด้านเดียวหรือทั้งสองด้าน — ด้านที่ไม่กรอกคำนวณจากส่วนหลัก
      const read = (raw) => (raw && String(raw).trim() ? toCm(raw) : null);
      const src = KIND[m.confirm?.source] || 'user';
      return {
        id: m.id,
        box: { x: m.x, y: m.y, width: Math.max(1, m.w), height: Math.max(1, m.h) },
        wCm: m.confirm ? read(m.confirm.raw) : null,
        hCm: m.confirm ? read(m.confirm.rawH) : null,
        sources: { w: src, h: src },
      };
    }
    const len = Math.max(1, lineLength(m));
    const cm = m.confirm ? toCm(m.confirm.raw) : null;
    const src = KIND[m.confirm?.source] || 'user';
    return {
      id: m.id,
      box: { x: 0, y: 0, width: m.axis === 'x' ? len : 1, height: m.axis === 'y' ? len : 1 },
      wCm: m.axis === 'x' ? cm : null,
      hCm: m.axis === 'y' ? cm : null,
      sources: { w: src, h: src },
    };
  });
}

/** ค่าของเส้น (ตามแกนของเส้น) จากผลของ measureParts */
export const valueOf = (m, sizes) => (sizes?.[m.id] ? (m.axis === 'y' ? sizes[m.id].height : sizes[m.id].width) : { value: null, source: 'none' });

/** ค่าทั้งสองด้านของกรอบ { width, height } */
export const boxValues = (m, sizes) => sizes?.[m.id] || { width: { value: null, source: 'none' }, height: { value: null, source: 'none' } };
