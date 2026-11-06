// งานภาพแสดงขนาดป้ายที่บันทึกไว้ — ตรวจและทำความสะอาดข้อมูลก่อนบันทึก/หลังอ่าน (ไม่ใช้ DOM ไม่ใช้ Node)
// แยกจากโครงการออกแบบป้าย (ไม่เปลี่ยนโครงสร้างโครงการเดิม) — เก็บใน data/dimension-jobs/<id>.json
//
// sizeSource บอกที่มาของความกว้าง/สูงที่กรอก:
//   customer = ขนาดจริงที่ลูกค้ากำหนด · suggested = นำขนาดแนะนำมาใช้ · unknown = ไม่ทราบ (เช่น ข้อมูลรุ่นเก่า)
// ข้อมูลที่ไม่ได้ระบุ sizeSource ไว้ ห้ามถือเป็นขนาดจริงเอง → unknown
//
// รุ่น 2: "ส่วนที่ยืนยันขนาดจริง" — ทุกส่วน (รวมทั้งป้าย) ยืนยันขนาดได้ และมีส่วนหลัก (mainId) ที่ใช้คำนวณส่วนอื่น
//   items[].confirm = { wRaw, hRaw } ขนาดที่ยืนยัน (ล็อก) · items[].drawnBox = กรอบตามที่ผู้ใช้ลาก (ย้อนการจัดกรอบอัตโนมัติ)
//   ทั้งป้าย: widthRaw/heightRaw + signConfirmed · รุ่น 1 แปลงอัตโนมัติ (ไม่ลบข้อมูล):
//   refMode 'item' → ส่วนอ้างอิงยืนยันด้านที่รู้ และเป็นส่วนหลัก · refMode 'sign' ที่มีตัวเลข → ทั้งป้ายยืนยันและเป็นส่วนหลัก
//
// รุ่น 3: "วัดทีละเส้น" — measures[] = เส้นบอกขนาดทีละเส้น (ดู src/shared/size-lines.js)
//   { id: 'd1', type: 'size'|'gap', axis: 'x'|'y', a, b, at, name, confirm: { raw, source }|null, drawn, side, hidden, overall }
//   mainId = รหัสเส้นหลัก · รุ่น 1/2 แปลงอัตโนมัติ: กรอบแต่ละกรอบ → เส้นกว้าง/สูงตามที่เคยแสดง (ขนาดที่ยืนยันยังล็อก)
//   ทั้งป้ายที่ยืนยันไว้ → เส้นขนาดรวม · ข้อมูลรุ่นเดิม (items, widthRaw, …) เก็บไว้ตามเดิม ไม่ลบ
//
// รุ่น 4: เพิ่ม "กรอบวัด" ใน measures[] (เครื่องมือหลัก) — เส้นวัดรุ่น 3 อ่านได้ตามเดิมทุกค่า
//   { id, type: 'box', x, y, w, h, name, confirm: { raw (กว้าง), rawH (สูง), source }|null, drawn: {x,y,w,h}|null,
//     showW, showH, sideW, sideH, pin, hidden, overall: 'box'|null } · เส้นวัดมี pin (ล็อกตำแหน่งในภาพ) เพิ่ม
//   bounds = แสดงเส้นปะขอบเขตการวัดในภาพ (ไม่มีค่า = ปิด → งานที่บันทึกก่อนมีตัวเลือกนี้แสดงผลตามเดิม)

import { isValidId } from './project-model.js';
import { LENGTH_UNITS } from './sign-dimensions.js';

export const DIMENSION_JOB_VERSION = 4;
export const DIMENSION_JOB_LIMITS = { items: 60, measures: 120, name: 120, imageBytes: 25 * 1024 * 1024, thumbBytes: 200 * 1024 };
const SIZE_SOURCES = ['customer', 'suggested', 'unknown'];

const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const isoOr = (v, d) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

function box(b) {
  if (!b || typeof b !== 'object') return null;
  const out = { x: Math.max(0, Math.round(num(b.x))), y: Math.max(0, Math.round(num(b.y))), width: Math.round(num(b.width)), height: Math.round(num(b.height)) };
  return out.width > 0 && out.height > 0 ? out : null;
}

function dataUrl(v, max) {
  return typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(v) && v.length <= max ? v : '';
}

// ค่าที่คำนวณไว้ตอนบันทึก (สำหรับแสดงในรายการ — เปิดงานแล้วระบบคำนวณใหม่จากข้อมูลจริงเสมอ)
function measure(m) {
  const one = (d) => (d && typeof d === 'object' && Number.isFinite(Number(d.value)) ? { value: Number(d.value), source: oneOf(d.source, ['user', 'estimated', 'suggested', 'unknown'], 'estimated') } : null);
  return { width: one(m?.width), height: one(m?.height) };
}

function line(m, i) {
  if (!m || typeof m !== 'object') return null;
  const axis = oneOf(m.axis, ['x', 'y'], null);
  if (!axis) return null;
  let a = Math.round(num(m.a, -1));
  let b = Math.round(num(m.b, -1));
  if (a > b) [a, b] = [b, a];
  if (a < 0 || b - a < 1) return null;
  const pos = (v) => (v && typeof v === 'object' ? { a: Math.max(0, Math.round(num(v.a))), b: Math.max(0, Math.round(num(v.b))), at: Math.max(0, Math.round(num(v.at))) } : null);
  const raw = m.confirm && typeof m.confirm === 'object' ? str(m.confirm.raw, 40) : '';
  return {
    id: /^d\d{1,4}$/.test(m.id) ? m.id : `d${i + 1}`,
    type: oneOf(m.type, ['size', 'gap'], 'size'),
    axis,
    a,
    b,
    at: Math.max(0, Math.round(num(m.at))),
    name: str(m.name, DIMENSION_JOB_LIMITS.name),
    confirm: raw.trim() ? { raw, source: oneOf(m.confirm.source, SIZE_SOURCES, 'customer') } : null,
    drawn: pos(m.drawn),
    side: oneOf(m.side, axis === 'x' ? ['auto', 'top', 'bottom'] : ['auto', 'left', 'right'], 'auto'),
    hidden: m.hidden === true,
    pin: m.pin === true,
    overall: oneOf(m.overall, ['w', 'h'], null),
  };
}

// กรอบวัด (รุ่น 4)
function boxMeasure(m, i) {
  const g = (v) => (v && typeof v === 'object' ? { x: Math.max(0, Math.round(num(v.x))), y: Math.max(0, Math.round(num(v.y))), w: Math.round(num(v.w)), h: Math.round(num(v.h)) } : null);
  const b = g(m);
  if (!b || b.w < 1 || b.h < 1) return null;
  const d = g(m.drawn);
  const c = m.confirm && typeof m.confirm === 'object' ? { raw: str(m.confirm.raw, 40), rawH: str(m.confirm.rawH, 40) } : null;
  return {
    id: /^d\d{1,4}$/.test(m.id) ? m.id : `d${i + 1}`,
    type: 'box',
    ...b,
    name: str(m.name, DIMENSION_JOB_LIMITS.name),
    confirm: c && (c.raw.trim() || c.rawH.trim()) ? { ...c, source: oneOf(m.confirm.source, SIZE_SOURCES, 'customer') } : null,
    drawn: d && d.w > 0 && d.h > 0 ? d : null,
    showW: m.showW === true,
    showH: m.showH === true,
    sideW: oneOf(m.sideW, ['auto', 'top', 'bottom'], 'auto'),
    sideH: oneOf(m.sideH, ['auto', 'left', 'right'], 'auto'),
    pin: m.pin === true,
    hidden: m.hidden === true,
    overall: m.overall === 'box' ? 'box' : null,
  };
}

const measureItem = (m, i) => (m && typeof m === 'object' && m.type === 'box' ? boxMeasure(m, i) : line(m, i));

// รุ่น 1/2 → เส้นวัด: กรอบ → เส้นกว้าง/สูง (ตามที่เคยแสดง หรือที่ยืนยันไว้) · ทั้งป้ายที่ยืนยัน → เส้นขนาดรวม
function linesFromBoxes({ items, signConfirmed, signBox, widthRaw, heightRaw, sizeSource, signShowW, signShowH, mainId }) {
  const out = [];
  const add = (m) => {
    const id = `d${out.length + 1}`;
    out.push({ id, type: 'size', drawn: null, ...m });
    return id;
  };
  const mid = (v, len) => Math.round(v + len / 2);
  const ids = {};
  if (signConfirmed && signBox) {
    const b = signBox;
    const w = widthRaw.trim() ? add({ axis: 'x', a: b.x, b: b.x + b.width, at: mid(b.y, b.height), name: 'ทั้งป้าย', confirm: { raw: widthRaw, source: sizeSource }, side: 'bottom', hidden: !signShowW, overall: 'w' }) : null;
    const h = heightRaw.trim() ? add({ axis: 'y', a: b.y, b: b.y + b.height, at: mid(b.x, b.width), name: 'ทั้งป้าย', confirm: { raw: heightRaw, source: sizeSource }, side: 'left', hidden: !signShowH, overall: 'h' }) : null;
    ids.sign = w || h;
  }
  for (const it of items) {
    const wr = it.confirm?.wRaw?.trim() ? it.confirm.wRaw : '';
    const hr = it.confirm?.hRaw?.trim() ? it.confirm.hRaw : '';
    const b = it.box;
    const w = it.showW || wr ? add({ axis: 'x', a: b.x, b: b.x + b.width, at: mid(b.y, b.height), name: it.name, confirm: wr ? { raw: wr, source: 'customer' } : null, side: it.wSide, hidden: !it.showW, overall: null }) : null;
    const h = it.showH || hr ? add({ axis: 'y', a: b.y, b: b.y + b.height, at: mid(b.x, b.width), name: it.name, confirm: hr ? { raw: hr, source: 'customer' } : null, side: it.hSide, hidden: !it.showH, overall: null }) : null;
    ids[it.id] = wr ? w : hr ? h : w || h;
  }
  return { measures: out, mainId: (mainId && ids[mainId]) || '' };
}

/** @throws {Error} ข้อมูลเสีย/ไม่ใช่งานภาพแสดงขนาด */
export function normalizeDimensionJob(input) {
  if (!input || typeof input !== 'object') throw new Error('ข้อมูลงานภาพแสดงขนาดไม่ถูกต้อง');
  if (!isValidId(input.id)) throw new Error('รหัสงานไม่ถูกต้อง');
  const img = input.image && typeof input.image === 'object' ? input.image : {};
  const src = dataUrl(img.dataUrl, DIMENSION_JOB_LIMITS.imageBytes);
  if (!src) throw new Error('งานนี้ไม่มีภาพป้าย หรือภาพเสียหาย');
  const now = new Date().toISOString();
  const items = (Array.isArray(input.items) ? input.items : []).slice(0, DIMENSION_JOB_LIMITS.items).map((it, i) => {
    const b = box(it?.box);
    if (!b) return null;
    const c = it.confirm && typeof it.confirm === 'object' ? { wRaw: str(it.confirm.wRaw, 40), hRaw: str(it.confirm.hRaw, 40) } : null;
    return {
      id: /^m\d{1,4}$/.test(it.id) ? it.id : `m${i + 1}`,
      name: str(it.name, DIMENSION_JOB_LIMITS.name) || `กรอบ ${i + 1}`,
      box: b,
      drawnBox: box(it.drawnBox),
      confirm: c && (c.wRaw.trim() || c.hRaw.trim()) ? c : null,
      showW: bool(it.showW, true),
      showH: bool(it.showH, true),
      wSide: oneOf(it.wSide, ['top', 'bottom'], 'top'),
      hSide: oneOf(it.hSide, ['left', 'right'], 'left'),
    };
  }).filter(Boolean);
  const maxN = items.reduce((n, it) => Math.max(n, Number(it.id.slice(1))), 0);
  const ids = new Set(items.map((i) => i.id));
  const widthRaw = str(input.widthRaw, 40);
  const heightRaw = str(input.heightRaw, 40);
  let signConfirmed = input.signConfirmed === true;
  let mainId = input.mainId === 'sign' || ids.has(input.mainId) ? input.mainId : '';
  const ver = Number(input.version) || 1;
  if (ver < 2) {
    // แปลงจากรุ่น 1 — ผลการคำนวณเท่าเดิม
    const refMode = oneOf(input.refMode, ['sign', 'item'], 'sign');
    const refItem = refMode === 'item' && items.find((it) => it.id === input.refItemId);
    const refRaw = str(input.refRaw, 40);
    signConfirmed = refMode === 'sign' && Boolean(widthRaw.trim() || heightRaw.trim());
    mainId = '';
    if (refItem && refRaw.trim()) {
      refItem.confirm = input.refAxis === 'w' ? { wRaw: refRaw, hRaw: '' } : { wRaw: '', hRaw: refRaw };
      mainId = refItem.id;
    } else if (signConfirmed) {
      mainId = 'sign';
    }
  }
  if (mainId === 'sign' && !signConfirmed) mainId = '';
  if (mainId && mainId !== 'sign' && !items.find((it) => it.id === mainId)?.confirm) mainId = '';
  const signBox = box(input.box);
  const signShowW = bool(input.signShowW, true);
  const signShowH = bool(input.signShowH, true);
  const sizeSource = oneOf(input.sizeSource, SIZE_SOURCES, 'unknown');
  let measures;
  let measureMain;
  if (ver >= 3) {
    const seen = new Set();
    measures = (Array.isArray(input.measures) ? input.measures : []).slice(0, DIMENSION_JOB_LIMITS.measures).map(measureItem).filter(Boolean).map((m) => {
      let { id } = m;
      for (let k = 1; seen.has(id); k += 1) id = `d${k}`;
      seen.add(id);
      return { ...m, id };
    });
    measureMain = measures.find((m) => m.id === input.mainId && m.confirm) ? input.mainId : '';
  } else {
    ({ measures, mainId: measureMain } = linesFromBoxes({ items, signConfirmed, signBox, widthRaw, heightRaw, sizeSource, signShowW, signShowH, mainId }));
  }
  const maxD = measures.reduce((n, m) => Math.max(n, Number(m.id.slice(1))), 0);
  return {
    version: DIMENSION_JOB_VERSION,
    id: input.id,
    name: str(input.name, DIMENSION_JOB_LIMITS.name).trim(),
    createdAt: isoOr(input.createdAt, now),
    updatedAt: isoOr(input.updatedAt, now),
    image: {
      name: str(img.name, 200) || 'ภาพป้าย.png',
      dataUrl: src,
      width: Math.max(0, Math.round(num(img.width))),
      height: Math.max(0, Math.round(num(img.height))),
    },
    thumb: dataUrl(input.thumb, DIMENSION_JOB_LIMITS.thumbBytes),
    unit: oneOf(input.unit, Object.keys(LENGTH_UNITS), 'cm'),
    widthRaw,
    heightRaw,
    signConfirmed,
    measures,
    nextMeasure: Math.max(maxD + 1, Math.round(num(input.nextMeasure, 1))),
    mainId: measureMain,
    // ไม่ระบุที่มา = ไม่ทราบ (ห้ามเปลี่ยนเป็นขนาดจริงโดยไม่มีข้อมูลรองรับ)
    sizeSource,
    trialOn: input.trialOn === true,
    trialRaw: str(input.trialRaw, 40),
    box: signBox,
    manualBox: input.manualBox === true,
    items,
    nextItem: Math.max(maxN + 1, Math.round(num(input.nextItem, 1))),
    signShowW,
    signShowH,
    removeBackground: input.removeBackground === true ? true : input.removeBackground === false ? false : null,
    tolerance: Math.min(80, Math.max(4, Math.round(num(input.tolerance, 24)))),
    lineTheme: oneOf(input.lineTheme, ['dark', 'light'], 'dark'),
    results: {
      sign: measure(input.results?.sign),
      items: (Array.isArray(input.results?.items) ? input.results.items : []).filter((r) => ids.has(r?.id)).map((r) => ({ id: r.id, ...measure(r) })),
      measures: (Array.isArray(input.results?.measures) ? input.results.measures : []).filter((r) => measures.some((m) => m.id === r?.id)).map((r) => ({ id: r.id, value: measure({ width: r.value }).width, ...(r.height ? { height: measure({ width: r.height }).width } : {}) })),
    },
    snap: input.snap === true,
    // เส้นปะขอบเขตการวัด: งานที่บันทึกก่อนมีตัวเลือกนี้ = ปิด (เปิดงานเก่าแล้วภาพเหมือนเดิม)
    bounds: input.bounds === true,
  };
}

/** ข้อมูลย่อสำหรับรายการงาน (ไม่รวมภาพต้นฉบับขนาดใหญ่) */
export function summarizeDimensionJob(job) {
  return {
    id: job.id,
    name: job.name || job.image.name,
    imageName: job.image.name,
    updatedAt: job.updatedAt,
    createdAt: job.createdAt,
    thumb: job.thumb,
    unit: job.unit,
    sign: job.results.sign,
    sizeSource: job.sizeSource,
    itemCount: job.items.length,
    measureCount: job.measures.length,
    confirmedCount: job.measures.filter((m) => m.confirm).length,
  };
}
