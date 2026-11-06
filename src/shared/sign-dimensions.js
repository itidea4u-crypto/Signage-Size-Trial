// เมนู "ภาพแสดงขนาดป้าย" — ตรรกะล้วน (ไม่ใช้ DOM) ทดสอบด้วย unit test
// ใช้โดยหน้า pages/sign-dimensions.js และต้นแบบใน prototypes/sign-dimensions/ (ใช้โค้ดชุดเดียวกัน)
//
// หลักการ
// - ไม่แตะพิกเซลของป้าย: ผลลัพธ์คือภาพที่ "ตัด" ตามกรอบวัดแบบ 1:1 (ไม่ย่อ/ขยาย) แล้วเติมพื้นที่โปร่งใสรอบ ๆ
//   สำหรับเส้นวัด — เส้นทุกเส้นอยู่นอกกรอบป้ายเสมอ
// - ลบพื้นหลังเฉพาะเมื่อผู้ใช้ยืนยัน และลบเฉพาะส่วนที่ "ต่อเนื่องกับขอบภาพ" (สีเดียวกันที่อยู่ในป้ายไม่ถูกลบ)
// - ไม่สร้างตัวเลขเอง: ต้องมีความกว้างหรือความสูงจากผู้ใช้อย่างน้อย 1 ค่า ค่าที่คำนวณจากสัดส่วนภาพเป็น "ค่าประมาณ"
// - ขนาด 3 ประเภท (SIZE_KINDS): ขนาดจริง (ลูกค้ากำหนด — ใช้ทันที ไม่ถามยืนยัน) · ขนาดประมาณ (คำนวณจากภาพ)
//   · ขนาดแนะนำ (เฉพาะเมื่อพนักงานขอเอง) — ป้ายกำกับในภาพแยกประเภทให้เห็นชัด
// - ภาพที่ส่งออกมีเฉพาะ ภาพป้าย + เส้นประ + ลูกศร + ตัวเลขขนาด และหมายเหตุประเภทขนาดเมื่อมีค่าประมาณ/ค่าแนะนำ

// ---------------------------------------------------------------- 1) วิเคราะห์พื้นหลัง

const ALPHA_EMPTY = 16; // ต่ำกว่านี้ถือว่าโปร่งใส

function borderPixels(w, h) {
  const out = [];
  for (let x = 0; x < w; x += 1) out.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y += 1) out.push(y * w, y * w + w - 1);
  return out;
}

// ความต่างของสีแบบช่องที่ต่างมากที่สุด (0–255)
export function colorDistance(rgba, p, color) {
  const i = p * 4;
  return Math.max(Math.abs(rgba[i] - color[0]), Math.abs(rgba[i + 1] - color[1]), Math.abs(rgba[i + 2] - color[2]));
}

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * ภาพมีพื้นหลังแบบไหน
 * - transparent: ขอบภาพโปร่งใสแทบทั้งหมด (PNG โปร่งใสจริง) → ใช้ได้เลย
 * - solid: ขอบภาพเป็นสีเดียวกันเกือบทั้งหมด (เช่น พื้นขาวจาก ChatGPT) → เสนอให้ลบ แต่ต้องให้ผู้ใช้ยืนยันก่อน
 * - complex: ขอบภาพหลายสี (ภาพจำลองบนผนัง ภาพถ่าย) → ลบอัตโนมัติไม่ได้ ให้ผู้ใช้ลากกรอบเอง
 */
export function analyzeBackground(rgba, w, h, { tolerance = 24 } = {}) {
  const border = borderPixels(w, h);
  const transparent = border.filter((p) => rgba[p * 4 + 3] < ALPHA_EMPTY).length;
  if (transparent / border.length >= 0.9) return { kind: 'transparent', borderMatch: transparent / border.length };
  const opaque = border.filter((p) => rgba[p * 4 + 3] >= ALPHA_EMPTY);
  const color = [0, 1, 2].map((c) => median(opaque.map((p) => rgba[p * 4 + c])));
  const match = opaque.filter((p) => colorDistance(rgba, p, color) <= tolerance).length / border.length;
  if (match >= 0.9) return { kind: 'solid', color, borderMatch: match };
  return { kind: 'complex', color, borderMatch: match };
}

/**
 * หน้ากากพื้นหลัง (1 = พื้นหลัง) — ไล่จากขอบภาพเข้าไป (flood fill 4 ทิศ)
 * ลบเฉพาะพิกเซลที่ต่อเนื่องกับขอบภาพ สีเดียวกับพื้นที่ถูกล้อมอยู่ในป้าย (เช่น ตัวอักษรขาวในกรอบ) จึงไม่ถูกลบ
 */
export function backgroundMask(rgba, w, h, background, { tolerance = 24 } = {}) {
  const mask = new Uint8Array(w * h);
  if (background.kind === 'complex') return mask;
  const isBg = background.kind === 'transparent'
    ? (p) => rgba[p * 4 + 3] < ALPHA_EMPTY
    : (p) => rgba[p * 4 + 3] < ALPHA_EMPTY || colorDistance(rgba, p, background.color) <= tolerance;
  const stack = [];
  for (const p of borderPixels(w, h)) {
    if (!mask[p] && isBg(p)) {
      mask[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of next) {
      if (q >= 0 && !mask[q] && isBg(q)) {
        mask[q] = 1;
        stack.push(q);
      }
    }
  }
  return mask;
}

// ---------------------------------------------------------------- 2) กรอบวัดจากองค์ประกอบทั้งหมดของป้าย

/**
 * กรอบที่ครอบทุกส่วนของป้าย (รวมตัวอักษรแยกชิ้น สระ วรรณยุกต์) — ไม่ใช่ขนาดของรูปภาพ
 * ตัดจุดรบกวนเล็ก ๆ (เช่น จุด JPEG) ที่มีขนาดไม่เกิน minSpeck พิกเซลออก
 * @returns {null | { x, y, width, height, components, dropped }}
 */
export function findBounds(rgba, w, h, { mask = null, alphaThreshold = 24, minSpeck = 4 } = {}) {
  const fg = (p) => !(mask && mask[p]) && rgba[p * 4 + 3] >= alphaThreshold;
  const seen = new Uint8Array(w * h);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let components = 0;
  let dropped = 0;
  for (let start = 0; start < w * h; start += 1) {
    if (seen[start] || !fg(start)) continue;
    // ไล่ส่วนที่ติดกัน (8 ทิศ) เพื่อดูขนาดของชิ้น
    const stack = [start];
    seen[start] = 1;
    let size = 0;
    let cx0 = w;
    let cy0 = h;
    let cx1 = -1;
    let cy1 = -1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      size += 1;
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
            if (!seen[q] && fg(q)) {
              seen[q] = 1;
              stack.push(q);
            }
          }
        }
      }
    }
    if (size <= minSpeck) {
      dropped += 1;
      continue;
    }
    components += 1;
    x0 = Math.min(x0, cx0);
    y0 = Math.min(y0, cy0);
    x1 = Math.max(x1, cx1);
    y1 = Math.max(y1, cy1);
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, components, dropped };
}

// กรอบที่ผู้ใช้ลากปรับ — บังคับให้อยู่ในภาพและมีขนาดอย่างน้อย 1 พิกเซล
export function clampBox(box, w, h) {
  const x = Math.max(0, Math.min(w - 1, Math.round(box.x)));
  const y = Math.max(0, Math.min(h - 1, Math.round(box.y)));
  return {
    x,
    y,
    width: Math.max(1, Math.min(w - x, Math.round(box.width))),
    height: Math.max(1, Math.min(h - y, Math.round(box.height))),
  };
}

/**
 * ข้อควรตรวจเรื่องพื้นหลัง — แจ้งก่อนลบ ไม่ลบส่วนของป้ายโดยไม่ตั้งใจ
 * nearBgInside: พิกเซลในกรอบที่สีใกล้พื้นหลังแต่ไม่ถูกลบ (เช่น ตัวอักษรขาวบนป้ายพื้นขาว) — ส่วนที่สีเดียวกันแต่แตะขอบป้ายอาจถูกลบไปด้วย
 */
export function backgroundWarnings(rgba, w, h, background, mask, box, { tolerance = 24 } = {}) {
  const out = [];
  if (background.kind === 'complex') {
    out.push({ code: 'complex', message: 'ภาพมีพื้นหลังหลายสี (เช่น ภาพจำลองบนผนัง) — ลบพื้นหลังอัตโนมัติไม่ได้ กรุณาลากกรอบวัดให้ตรงขอบป้ายเอง' });
    return out;
  }
  if (background.kind !== 'solid' || !box) return out;
  out.push({ code: 'solid', message: 'ภาพมีพื้นหลังติดมา — ตรวจในภาพตัวอย่างว่าส่วนที่จะลบ (ลายตาราง) เป็นพื้นหลังเท่านั้น ก่อนกดยืนยันลบพื้นหลัง' });
  let nearBg = 0;
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      const p = y * w + x;
      if (!mask[p] && rgba[p * 4 + 3] >= ALPHA_EMPTY && colorDistance(rgba, p, background.color) <= tolerance * 2) nearBg += 1;
    }
  }
  const pct = (nearBg / (box.width * box.height)) * 100;
  if (pct >= 0.5) {
    out.push({ code: 'near-bg', pct, message: `ป้ายมีส่วนที่สีใกล้พื้นหลัง (${pct.toFixed(1)}% ของกรอบ) เช่น ตัวอักษรหรือขอบสีเดียวกับพื้น — ส่วนที่แตะขอบป้ายอาจถูกลบไปด้วย ตรวจขอบป้ายให้ดี หรือเลือก "ไม่ลบพื้นหลัง"` });
  }
  return out;
}

// ---------------------------------------------------------------- 3) คำนวณขนาด

// หน่วยวัด — คำนวณภายในเป็น ซม. เสมอ แปลงเฉพาะตอนรับค่าและแสดงผล
export const LENGTH_UNITS = {
  cm: { label: 'ซม.', short: 'cm', toCm: 1, digits: 1, suffix: /\s*(?:cm|ซม\.?)$/i },
  m: { label: 'ม.', short: 'm', toCm: 100, digits: 2, suffix: /\s*(?:m|ม\.?|เมตร)$/i },
  mm: { label: 'มม.', short: 'mm', toCm: 0.1, digits: 0, suffix: /\s*(?:mm|มม\.?)$/i },
  in: { label: 'นิ้ว', short: 'in', toCm: 2.54, digits: 1, suffix: /\s*(?:in|นิ้ว|")$/i },
};
const unitOf = (unit) => LENGTH_UNITS[unit] || LENGTH_UNITS.cm;
const EXAMPLE = { cm: '150', m: '3', mm: '1500', in: '60' };

/** ค่าที่ผู้ใช้กรอก (หน่วยที่เลือก) → ซม. — ว่าง = ยังไม่ทราบ */
export function parseLength(raw, unit = 'cm') {
  const u = unitOf(unit);
  const s = String(raw ?? '').trim().replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50)).replace(/,/g, '').replace(u.suffix, '').trim();
  if (!s) return { ok: true, value: null };
  if (!/^\d+(?:\.\d+)?$/.test(s)) return { ok: false, error: `ใส่เป็นตัวเลข (${u.label}) เช่น ${EXAMPLE[unit] || '150'}` };
  const n = Number(s);
  if (n <= 0) return { ok: false, error: 'ต้องมากกว่า 0' };
  const cm = n * u.toCm;
  if (cm > 100000) return { ok: false, error: 'ค่ามากเกินไป' };
  return { ok: true, value: cm };
}

/** ค่าที่ผู้ใช้กรอก (ซม.) — ว่าง = ยังไม่ทราบ */
export function parseCm(raw) {
  return parseLength(raw, 'cm');
}

// ปัดค่าประมาณ: ชิ้นเล็กกว่า 10 ซม. (เช่น ระยะห่าง จุดคั่น) ปัดทีละ 0.1 ซม. · เล็กกว่า 50 ซม. ทีละ 0.5 ซม. · นอกนั้นจำนวนเต็ม
export function roundCm(v) {
  if (v < 10) return Math.round(v * 10) / 10;
  return v < 50 ? Math.round(v * 2) / 2 : Math.round(v);
}

export const RATIO_TOLERANCE_PCT = 3;

/**
 * @param {{ widthCm: number|null, heightCm: number|null, boxWidth: number, boxHeight: number }} args
 * source: user = ผู้ใช้กำหนด · estimated = คำนวณจากสัดส่วนภาพ (ค่าประมาณ) · none = ไม่ทราบ (ไม่สร้างตัวเลขเอง)
 */
export function computeDimensions({ widthCm, heightCm, boxWidth, boxHeight }) {
  const ratio = boxWidth / boxHeight;
  const W = widthCm > 0 ? widthCm : null;
  const H = heightCm > 0 ? heightCm : null;
  if (W && H) {
    const ratioDiffPct = ((W / H) / ratio - 1) * 100;
    return { width: { value: W, source: 'user' }, height: { value: H, source: 'user' }, imageRatio: ratio, ratioDiffPct, ratioWarning: Math.abs(ratioDiffPct) > RATIO_TOLERANCE_PCT };
  }
  if (H) return { width: { value: roundCm(H * ratio), source: 'estimated' }, height: { value: H, source: 'user' }, imageRatio: ratio, ratioWarning: false };
  if (W) return { width: { value: W, source: 'user' }, height: { value: roundCm(W / ratio), source: 'estimated' }, imageRatio: ratio, ratioWarning: false };
  return { width: { value: null, source: 'none' }, height: { value: null, source: 'none' }, imageRatio: ratio, ratioWarning: false, missing: true };
}

export function formatCm(v) {
  return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/** ซม. → ตัวเลขในหน่วยที่เลือก (เช่น 240 ซม. = "2.4" ม.) */
export function formatLength(cm, unit = 'cm') {
  const u = unitOf(unit);
  return (cm / u.toCm).toLocaleString('en-US', { maximumFractionDigits: u.digits });
}

/**
 * ประเภทของขนาด — source ของค่าแต่ละค่า
 * user = ขนาดจริงที่ลูกค้ากำหนด · estimated = ขนาดประมาณจากภาพ · suggested = ขนาดแนะนำที่พนักงานเลือกใช้
 * unknown = ขนาดจากงานเดิมที่ไม่ได้ระบุประเภท (ไม่ถือเป็นขนาดจริงเอง)
 */
export const SIZE_KINDS = {
  user: { label: 'ขนาดจริง', note: 'ตามที่ลูกค้ากำหนด' },
  estimated: { label: 'ขนาดประมาณ', note: 'คำนวณจากสัดส่วนของภาพ' },
  suggested: { label: 'ขนาดแนะนำ', note: 'ระบบช่วยประเมิน ยังไม่ใช่ขนาดที่ลูกค้ากำหนด' },
  unknown: { label: 'ไม่ระบุประเภท', note: 'ขนาดจากงานเดิม ไม่ทราบว่าลูกค้ากำหนดหรือไม่' },
};

// ข้อความบนภาพ: ขนาดจริง "150 cm" · ประมาณ "≈ 150 cm (ประมาณ)" · แนะนำ "150 cm (แนะนำ)"
export function dimensionLabel(d, unit = 'cm') {
  if (!d || d.source === 'none' || d.value == null) return '';
  const v = `${formatLength(d.value, unit)} ${unitOf(unit).short}`;
  if (d.source === 'estimated') return `≈ ${v} (ประมาณ)`;
  if (d.source === 'suggested') return `${v} (แนะนำ)`;
  if (d.source === 'unknown') return `${v} (ไม่ระบุประเภท)`;
  return v;
}

/** หมายเหตุที่ติดไปกับภาพที่ส่งออก — เฉพาะเมื่อมีค่าประมาณ/ค่าแนะนำ (ขนาดจริงอย่างเดียวไม่มีหมายเหตุ) */
export const EXPORT_NOTES = {
  estimated: 'ขนาดประมาณจากภาพ ต้องตรวจสอบกับแบบจริงก่อนผลิต',
  suggested: '(แนะนำ) = ขนาดแนะนำ ยังไม่ใช่ขนาดที่ลูกค้ากำหนด',
  unknown: '(ไม่ระบุประเภท) = ขนาดจากงานเดิม ต้องยืนยันกับลูกค้าก่อนผลิต',
};
export function exportNotes(values) {
  const kinds = new Set(values.filter((d) => d && d.value != null).map((d) => d.source));
  return ['estimated', 'suggested', 'unknown'].filter((k) => kinds.has(k)).map((k) => (k === 'estimated' ? `≈ = ${EXPORT_NOTES.estimated}` : EXPORT_NOTES[k]));
}

// ---------------------------------------------------------------- 4) ตรวจก่อนส่งออก

/**
 * ตรวจก่อนส่งออก — ไม่มีขั้นยืนยันขนาด (ขนาดที่ลูกค้ากำหนดใช้ได้ทันที)
 * ต้องมีขนาดอ้างอิงจากผู้ใช้อย่างน้อย 1 ค่า (ห้ามสร้างตัวเลขเอง)
 */
export function checkExport(dims) {
  const errors = [];
  if (dims.missing) errors.push('กรอกความกว้างหรือความสูงอย่างน้อย 1 ค่า — โปรแกรมจะไม่สร้างตัวเลขขึ้นเอง');
  return { ok: errors.length === 0, errors, warnings: [] };
}

/** ประเภทรวมของขนาดป้าย (ใช้ตั้งชื่อไฟล์) */
export function sizeKindOf(dims, { trial = false } = {}) {
  if (trial) return 'trial';
  const s = [dims.width.source, dims.height.source];
  if (s.includes('suggested')) return 'suggested';
  if (s.includes('unknown')) return 'unknown';
  return s.every((x) => x === 'user') ? 'user' : 'estimated';
}

// ชื่อไฟล์ใหม่สำหรับภาพที่ส่งออก (ไม่ใช้ชื่อไฟล์ต้นฉบับ จึงไม่บันทึกทับต้นฉบับโดยไม่ตั้งใจ)
const FILE_KIND = { user: 'ขนาดจริง', estimated: 'ขนาดประมาณ', suggested: 'ขนาดแนะนำ', unknown: 'ไม่ระบุประเภท', trial: 'ทดลองปรับ' };
export function exportFileName(dims, { trial = false, unit = 'cm' } = {}) {
  const v = (d) => (d.value == null ? '' : formatLength(d.value, unit).replace(/,/g, ''));
  return `ขนาดป้าย-${FILE_KIND[sizeKindOf(dims, { trial })]}-${v(dims.width)}x${v(dims.height)}${unitOf(unit).short}.png`;
}

// ---------------------------------------------------------------- 5) ตำแหน่งเส้นวัดในภาพผลลัพธ์ — ดู sign-scale.js (measureLayout: วัดหลายส่วน)

// ---------------------------------------------------------------- 6) Prompt สำหรับ ChatGPT (ทางเลือก)

/**
 * ให้ ChatGPT วาดเส้นวัดบน "ไฟล์เดิม" ด้วย Python — ห้ามสร้างภาพใหม่
 * ใส่ตัวเลขและกรอบวัด (พิกเซล) ที่โปรแกรมคำนวณไว้แล้ว ChatGPT จึงไม่ต้องเดา
 */
export function buildDimensionPrompt({ fileName, imageSize, box, background, removeBackground, dims, unit = 'cm' }) {
  const src = (d) => `${SIZE_KINDS[d.source]?.label || ''} (${SIZE_KINDS[d.source]?.note || ''})`;
  const notes = exportNotes([dims.width, dims.height]);
  const bgLine = background.kind === 'transparent'
    ? 'พื้นหลังของภาพโปร่งใสอยู่แล้ว — คงไว้ตามเดิม'
    : removeBackground
      ? `ผู้ใช้ยืนยันให้ลบพื้นหลังสี rgb(${background.color.join(', ')}) — ลบเฉพาะส่วนที่ต่อเนื่องกับขอบภาพ (flood fill จากขอบ ค่าความคลาดเคลื่อนไม่เกิน 24) สีเดียวกันที่อยู่ในป้ายห้ามลบ`
      : 'ผู้ใช้เลือกไม่ลบพื้นหลัง — คงพิกเซลในกรอบวัดไว้ทั้งหมด (พื้นที่นอกกรอบเป็นโปร่งใส)';
  return [
    'ใช้ Python (เครื่องมือวิเคราะห์ข้อมูล) วาดเส้นแสดงขนาดลงบนไฟล์ภาพป้ายที่แนบมา — ห้ามสร้างภาพใหม่ด้วยเครื่องมือสร้างภาพ',
    'ถ้าใช้ Python ไม่ได้ ให้แจ้งตามจริง ห้ามสร้างภาพใหม่แทน และห้ามบอกว่าทำเสร็จแล้ว',
    '',
    '# ไฟล์และกรอบวัด (คำนวณจากโปรแกรมแล้ว)',
    `- ไฟล์: ${fileName} ขนาด ${imageSize.width} × ${imageSize.height} px`,
    `- กรอบวัด (ครอบทุกองค์ประกอบของป้าย): x=${box.x}, y=${box.y}, กว้าง ${box.width} px, สูง ${box.height} px`,
    `- ${bgLine}`,
    '',
    '# ขนาดที่ต้องแสดง',
    `- ความกว้าง: ${dimensionLabel(dims.width, unit)} — ${src(dims.width)}`,
    `- ความสูง: ${dimensionLabel(dims.height, unit)} — ${src(dims.height)}`,
    '- ใช้ข้อความตามนี้ตรงตัว ห้ามคำนวณ ปัด หรือเปลี่ยนตัวเลขใหม่ และห้ามเสนอขนาดอื่น — ค่าประมาณต้องมี "≈" กับคำว่า "(ประมาณ)" เสมอ',
    '',
    '# วิธีทำ',
    '1. ตัดภาพตามกรอบวัดแบบ 1:1 (ห้ามย่อ ขยาย หมุน หรือปรับสี) แล้ววางบนพื้นโปร่งใส (RGBA) ที่เว้นที่ด้านซ้ายและด้านล่าง',
    '2. วาดเส้นประรอบกรอบวัด ห่างจากขอบป้ายเล็กน้อย ไม่ทับป้าย',
    '3. ด้านล่าง: เส้นลูกศรแนวนอนยาวเท่าความกว้างกรอบ พร้อมข้อความความกว้างใต้เส้น',
    '4. ด้านซ้าย: เส้นลูกศรแนวตั้งยาวเท่าความสูงกรอบ พร้อมข้อความความสูง (หมุน 90°)',
    `5. ในภาพมีได้เฉพาะ ภาพป้าย เส้นประ ลูกศร และตัวเลขความกว้าง–ความสูง${notes.length ? ` และหมายเหตุใต้ภาพ: "${notes.join(' · ')}"` : ''} — ห้ามใส่ข้อความอื่นเพิ่ม`,
    '6. ห้ามเปลี่ยนรูปทรง สัดส่วน ข้อความ โลโก้ หรือรายละเอียดใด ๆ ของป้าย — พิกเซลในกรอบต้องเหมือนต้นฉบับ',
    '7. บันทึกเป็น PNG ที่มีช่องโปร่งใสจริง (RGBA) ตรวจว่ามุมภาพโปร่งใส แล้วให้ลิงก์ดาวน์โหลดไฟล์',
    '',
    'ตอบสั้น ๆ: ขนาดไฟล์ผลลัพธ์ (px) และยืนยันว่าไม่ได้แก้พิกเซลของป้าย — ห้ามรับประกันว่าตัวเลขเป็นขนาดจริงที่แม่นยำ ถ้าเป็นค่าประมาณ',
  ].join('\n');
}
