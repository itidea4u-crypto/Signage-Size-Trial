// หน้า "ภาพแสดงขนาดป้าย" — ① อัปโหลดภาพ → ② ลากกรอบ/เส้น → ③ กรอกขนาดจริงที่รู้ → ④ เลือกขนาดที่แสดง → ⑤ ดาวน์โหลด/บันทึก
//
// "ลากกรอบสำหรับวัดทั้งป้าย ลากเส้นสำหรับวัดรายละเอียด โปรแกรมจัดเส้นบอกขนาดให้เอง"
// ▭ ลากกรอบ (เครื่องมือหลัก ค่าเริ่มต้น): ครอบป้ายไดคัท โลโก้ หรือข้อความทั้งชุด → กรอกกว้าง/สูง (ด้านเดียวหรือทั้งคู่)
//   เลือกแสดงความกว้าง/ความสูงในภาพเอง (ไม่แสดงทั้งสองด้านเอง — ด้านที่ยืนยันแสดงให้) · ภาพที่ส่งออกไม่มีเส้นกรอบ
//   ลากมุมกรอบ = ปรับขนาด · ลากจุดกลาง = ย้าย · "ช่วยจับขอบ" หดกรอบชิดชิ้นงาน (ย้อนกลับได้)
// เส้น (เครื่องมือเสริม): ↔ ความกว้าง · ↕ ความสูง · ⇤⇥ ระยะห่าง แล้วลากบนภาพ
// - การลากหนึ่งครั้ง = เส้นบอกขนาด 1 เส้น อยู่ตรงที่ลาก (ไม่สร้างกว้าง + สูงพร้อมกัน ไม่บังคับจับขอบ)
// - "จับขอบตัวอักษร" เป็นตัวช่วยที่เปิดเองได้ และย้อนกลับเป็นเส้นตามที่ลากได้
// - แตะเส้นเพื่อแก้: ลากปลายเส้น = ปรับความยาว · ลากจุดกลางเส้น = ย้าย · ปุ่มปรับทีละนิดสำหรับจอสัมผัส · แก้ตัวเลขได้
// - กรอกขนาดจริงของเส้นที่รู้ แล้ว "ยืนยันขนาดจริง" → ล็อกตัวเลขและเส้น · เส้นแรกที่ยืนยันเป็นเส้นหลักที่ใช้คำนวณเส้นอื่น
//   ยืนยันเพิ่ม เส้นหลักไม่เปลี่ยนเอง · เพิ่ม/ลบ/แก้เส้นอื่นไม่กระทบขนาดที่ยืนยัน · ภาพไม่ตรงแบบผลิต → แจ้งเตือน
// - ขนาดรวมทั้งป้ายไม่แสดงเอง (กด "เพิ่มขนาดรวมทั้งป้าย")
// - ภาพ PNG: เส้นวัดจัดเองนอกพื้นที่ป้าย ไม่ทับตัวอักษร · ค่าที่คำนวณมี ≈ และหมายเหตุรวมจุดเดียว
// ตรรกะอยู่ใน src/shared/size-lines.js และ size-parts.js — ใช้ทั้งโปรแกรม Windows และเว็บแอป (web/size.html)
//
// แยกจากระบบออกแบบป้าย: ไม่แตะโครงการ ร่างอัตโนมัติ หรือคำสั่งออกแบบ — งานที่บันทึกเก็บแยกใน dimensionJobs

import { canSuggestSize, suggestSignSize, SUGGEST_MARGIN_PCT } from '../../../shared/size-suggest.js';
import {
  analyzeBackground, backgroundMask, backgroundWarnings, buildDimensionPrompt, checkExport, clampBox,
  dimensionLabel, exportFileName, exportNotes, findBounds, formatLength, LENGTH_UNITS, parseLength,
} from '../../../shared/sign-dimensions.js';
import { measureBox, measureLayout } from '../../../shared/sign-scale.js';
import { measureParts, nextMainId } from '../../../shared/size-parts.js';
import {
  arrangeSides, boundsOf, boxFromDrag, boxValues, cropOf, isBox, lineDims, lineFromDrag, lineLabel, lineLength, measureKindLabel, measuresAsParts, snapBox, snapMeasure, valueOf,
} from '../../../shared/size-lines.js';
import { newId } from '../../../shared/project-model.js';
import { convertLength } from '../../../shared/sign-size.js';
import { formatDate, h, icon } from '../dom.js';
import { canvasToPng, cropPixels, decodeFile, loadFonts, renderMeasured } from '../sign-canvas.js';
import { confirmDialog, toast, toastError } from '../ui.js';

export const page = { id: 'sign-dimensions', label: 'ภาพแสดงขนาดป้าย', hint: 'คำนวณขนาดจากภาพ ส่งออก PNG', icon: 'ruler' };

const ACCEPT = 'image/png,image/jpeg,image/webp';
const NAME_SUGGESTIONS = ['ข้อความหลัก', 'ข้อความรอง', 'โลโก้', 'สโลแกน', 'ชื่อร้าน', 'ตัวอักษร', 'ระยะห่าง', 'ทั้งป้าย'];
const TOOLS = [['w', '↔ ความกว้าง'], ['h', '↕ ความสูง'], ['gap', '⇤⇥ ระยะห่าง']];
const BOX_TOOL = ['box', '▭ ลากกรอบ'];
// ป้ายประเภทขนาดบนหน้าจอ (ภาพ PNG ใช้ ≈ นำหน้าค่าที่คำนวณ + หมายเหตุรวม)
const KIND = {
  user: { cls: 'sd-kind-user', label: 'ยืนยันแล้ว' },
  estimated: { cls: 'sd-kind-est', label: 'คำนวณจากภาพ' },
  suggested: { cls: 'sd-kind-sug', label: 'ขนาดแนะนำ' },
  unknown: { cls: 'sd-kind-unk', label: 'ไม่ระบุประเภท' },
  trial: { cls: 'sd-kind-unk', label: 'ทดลองปรับ' },
};

function freshState() {
  return {
    jobId: null, // งานที่บันทึกไว้ (null = งานใหม่ที่ยังไม่บันทึก)
    jobName: '',
    savedFp: '', // ลายนิ้วมือตอนบันทึก/เปิดล่าสุด — ใช้บอกว่ามีการแก้ที่ยังไม่บันทึก
    legacy: null, // ข้อมูลรุ่นเดิมของงานที่เปิด (กรอบ/ขนาดป้าย) — บันทึกคืนตามเดิม ไม่ลบ
    file: null,
    fileName: '',
    imageDataUrl: '',
    sourcePath: '', // ที่อยู่ไฟล์ต้นฉบับ — ใช้กันไม่ให้บันทึกทับ
    img: null, // { rgba, width, height }
    tolerance: 24,
    alphaThreshold: 24,
    background: null,
    mask: null,
    autoBox: null,
    box: null, // ขอบเขตของป้ายทั้งหมด (ไม่รวมพื้นที่ว่างของไฟล์)
    manualBox: false,
    removeBackground: null, // null = ยังไม่ตัดสินใจ (พื้นหลังที่เสี่ยงลบส่วนของป้ายต้องเลือกก่อนส่งออก)
    unit: 'cm',
    // เส้นวัด { id, type, axis, a, b, at, name, confirm: {raw,source}|null, draft: {raw,a,b,at}|null, drawn, side, hidden, overall }
    measures: [],
    nextMeasure: 1,
    mainId: '', // เส้นหลักที่ใช้คำนวณเส้นอื่น
    tool: 'box', // เครื่องมือหลัก = ลากกรอบ
    snap: false, // ช่วยจับขอบเมื่อลากกรอบ/เส้นใหม่ (ตัวช่วย — ปิดอยู่: อยู่ตรงที่ลาก)
    selectedId: null,
    trialOn: false, // ทดลองปรับขนาด (แยกจากขนาดที่ยืนยัน)
    trialRaw: '',
    lineTheme: 'dark',
    bounds: true, // เส้นปะขอบเขตการวัดในภาพ (งานใหม่เปิดไว้ · งานเก่าที่ไม่มีค่านี้ = ปิด แสดงผลตามเดิม)
    // ขนาดแนะนำ — เปิดเฉพาะเมื่อพนักงานกดเอง และยังไม่มีขนาดที่ยืนยันเลย
    suggestOpen: false,
    suggestW: '',
    suggestH: '',
    suggestMargin: String(SUGGEST_MARGIN_PCT),
  };
}

let state = freshState();
const jobsView = { open: true, items: [], loaded: false };
let view = null; // องค์ประกอบของหน้าที่แสดงอยู่ (null = ออกจากหน้านี้แล้ว)
let lastResult = null;
let loadCount = 0;

const api = () => window.ify;
// ส่วนที่พับไว้ในแผงเส้นที่เลือก: จำว่าเปิดอยู่ (กดปุ่มปรับทีละนิดหลายครั้งได้โดยไม่ต้องเปิดใหม่)
const folds = { nudge: false, lines: false };
const fold = (key, title, body) => h('details', { class: 'sd-fold', open: folds[key], 'data-fold': key, ontoggle: (e) => { folds[key] = e.target.open; } }, h('summary', {}, title), body);
const unitLabel = () => LENGTH_UNITS[state.unit].label;
const L = (d) => dimensionLabel(d, state.unit);
// ตัวเลขพร้อมหน่วย โดยไม่มีป้ายวงเล็บ (ประเภทแสดงด้วยป้ายสีแทน)
const plain = (d) => L(d).replace(/^≈ /, '').replace(/ \((ประมาณ|แนะนำ|ไม่ระบุประเภท)\)$/, '');

// ---------------------------------------------------------------- เส้นวัด

const measureOf = (id) => state.measures.find((m) => m.id === id);
const isLocked = (m) => Boolean(m?.confirm) && !m.draft;
const titleOf = (m) => (m ? m.name.trim() || measureKindLabel(m) : '');
const toCm = (raw) => {
  const r = parseLength(raw, state.unit);
  return r.ok ? r.value : null;
};
// ภาพสำหรับจับขอบ/จัดเส้น: พื้นหลังที่ตรวจพบไม่นับเป็นตัวป้ายเสมอ
const inkImage = () => ({ rgba: state.img.rgba, width: state.img.width, height: state.img.height, mask: state.mask, alphaThreshold: state.alphaThreshold });

// ---------------------------------------------------------------- โหลดและวิเคราะห์ภาพ

function readDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

// แปลงภาพที่บันทึกไว้ (data URL) กลับเป็นไฟล์ — ไม่ใช้ fetch() เพราะนโยบายความปลอดภัยของหน้าโปรแกรมไม่อนุญาต
function dataUrlToBlob(url) {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(url || '');
  if (!m) throw new Error('ภาพในงานนี้เสียหาย');
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

async function loadFile(file) {
  if (!ACCEPT.split(',').includes(file.type)) {
    toast('รองรับเฉพาะไฟล์ภาพ PNG, JPG หรือ WEBP', 'warn');
    return;
  }
  try {
    const [img, dataUrl] = await Promise.all([decodeFile(file), readDataUrl(file)]);
    // ภาพใหม่: เส้นวัดของภาพเดิมใช้ไม่ได้
    Object.assign(state, {
      file, fileName: file.name, imageDataUrl: dataUrl, sourcePath: api()?.file?.pathOf?.(file) || '', img,
      removeBackground: null, manualBox: false, measures: [], nextMeasure: 1, mainId: '', selectedId: null,
    });
    analyze();
    // พื้นหลังสีเดียวที่ลบได้อย่างปลอดภัย → ลบให้เลย (กด "ไม่ลบพื้นหลัง" ได้) · มีความเสี่ยง → ให้ผู้ใช้เลือก
    if (state.background.kind === 'solid') {
      const risky = backgroundWarnings(img.rgba, img.width, img.height, state.background, state.mask, state.box, { tolerance: state.tolerance }).some((w) => w.code !== 'solid');
      state.removeBackground = risky ? null : true;
    }
  } catch (err) {
    toastError(err, 'เปิดไฟล์ภาพไม่สำเร็จ');
  }
  redraw();
  loadCount += 1;
}

function analyze() {
  const { rgba, width, height } = state.img;
  state.background = analyzeBackground(rgba, width, height, { tolerance: state.tolerance });
  state.mask = backgroundMask(rgba, width, height, state.background, { tolerance: state.tolerance });
  // พื้นหลังโปร่งใสอยู่แล้ว ไม่ต้องถาม · พื้นหลังหลายสีลบอัตโนมัติไม่ได้
  if (state.background.kind === 'transparent') state.removeBackground = true;
  if (state.background.kind === 'complex') state.removeBackground = false;
  state.autoBox = findBounds(rgba, width, height, { mask: state.mask, alphaThreshold: state.alphaThreshold });
  if (!state.manualBox || !state.box) state.box = state.autoBox || { x: 0, y: 0, width, height };
}

// กรอบที่ครอบทั้งป้าย (กรอบ "ทั้งป้าย" หรือกรอบที่ขนาดเท่าขอบเขตป้าย ±3%) → ค่าของกรอบคือขนาดป้าย
function wholeBox() {
  const near = (a, b) => Math.abs(a - b) <= Math.max(2, b * 0.03);
  return state.measures.find((m) => isBox(m) && m.overall === 'box')
    || state.measures.find((m) => isBox(m) && near(m.w, state.box.width) && near(m.h, state.box.height)) || null;
}

function current() {
  if (!state.img || !state.box) return null;
  const t = parseLength(state.trialRaw, state.unit);
  const r = measureParts({ parts: measuresAsParts(state.measures, toCm), mainId: state.mainId, trialCm: state.trialOn && t.ok ? t.value : null });
  const errors = [];
  if (r.missing) errors.push('ยังไม่มีขนาดจริง — ลากกรอบหรือเส้นตรงส่วนที่รู้ขนาด แล้วกรอกขนาดจริง');
  if (state.trialOn && !r.missing && !r.trial) errors.unshift(t.ok ? 'กรอกขนาดที่ต้องการทดลอง หรือปิด "ทดลองปรับขนาด"' : `ขนาดทดลอง: ${t.error}`);
  if (state.background.kind === 'solid' && state.removeBackground === null) errors.unshift('ภาพมีพื้นหลังติดมา — เลือก "ลบพื้นหลัง" หรือ "ไม่ลบพื้นหลัง" (ขั้นที่ 1)');
  // ขนาดทั้งป้าย (ชื่อไฟล์/Prompt): เส้นขนาดรวมที่มี หรือคำนวณจากกรอบป้าย
  let sign = { width: { value: null, source: 'none' }, height: { value: null, source: 'none' }, missing: true };
  if (!r.missing) {
    const est = measureBox(state.box, r.trial || r.scale);
    const ow = state.measures.find((m) => m.overall === 'w');
    const oh = state.measures.find((m) => m.overall === 'h');
    const whole = wholeBox();
    const wv = whole ? boxValues(whole, r.sizes) : null;
    sign = { width: ow ? valueOf(ow, r.sizes) : wv ? wv.width : est.width, height: oh ? valueOf(oh, r.sizes) : wv ? wv.height : est.height, missing: false };
  }
  return { ...r, sign, value: (m) => valueOf(m, r.sizes), values: (m) => boxValues(m, r.sizes), check: { ok: errors.length === 0 && checkExport(sign).ok, errors } };
}

// ---------------------------------------------------------------- สร้าง / แก้ / ยืนยัน

// ตำแหน่งที่วัด (กรอบ: x y w h · เส้น: a b at) — ใช้จำค่าก่อนจับขอบ/ก่อนแก้
const geomOf = (m) => (isBox(m) ? { x: m.x, y: m.y, w: m.w, h: m.h } : { a: m.a, b: m.b, at: m.at });
const snapOf = (m) => (isBox(m) ? snapBox(inkImage(), m) : snapMeasure(inkImage(), m));
const NO_EDGE = (m) => (isBox(m) ? 'ไม่พบชิ้นงานในกรอบ' : 'ไม่พบขอบตัวอักษรตามแนวเส้น');

function addMeasure(geom) {
  const n = state.nextMeasure;
  state.nextMeasure += 1;
  const base = { id: `d${n}`, ...geom, name: '', confirm: null, draft: null, drawn: null, hidden: false, pin: false, overall: null };
  // กรอบใหม่ยังไม่แสดงด้านใดในภาพ — ผู้ใช้เลือกเอง (ด้านที่ยืนยันขนาดแสดงให้)
  const m = isBox(base) ? { ...base, showW: false, showH: false, sideW: 'auto', sideH: 'auto' } : { ...base, side: 'auto' };
  if (state.snap) {
    const s = snapOf(m);
    if (s) Object.assign(m, { drawn: geomOf(m) }, s);
    else toast(`${NO_EDGE(m)} — ใช้ตามที่ลาก`, 'warn');
  }
  state.measures.push(m);
  state.selectedId = m.id;
  redraw();
}

function snapSelected() {
  const m = measureOf(state.selectedId);
  if (!m || isLocked(m)) return;
  const s = snapOf(m);
  if (!s) {
    toast(`${NO_EDGE(m)} — ปรับด้วยมือ`, 'warn');
    return;
  }
  m.drawn = m.drawn || geomOf(m);
  Object.assign(m, s);
  redraw();
}

function undoSnap() {
  const m = measureOf(state.selectedId);
  if (!m?.drawn) return;
  Object.assign(m, m.drawn, { drawn: null });
  redraw();
}

// ขนาดรวมทั้งป้าย (ผู้ใช้กดเอง): กรอบครอบทั้งป้าย แสดงทั้งกว้างและสูง (ผู้ใช้ขอขนาดรวมเอง)
function addOverall() {
  const b = state.box;
  let m = state.measures.find((x) => x.overall === 'box');
  if (!m) {
    const n = state.nextMeasure;
    state.nextMeasure += 1;
    m = { id: `d${n}`, type: 'box', x: b.x, y: b.y, w: b.width, h: b.height, name: 'ทั้งป้าย', confirm: null, draft: null, drawn: null, showW: true, showH: true, sideW: 'auto', sideH: 'auto', pin: false, hidden: false, overall: 'box' };
    state.measures.push(m);
  }
  state.selectedId = m.id;
  redraw();
}

// ตรวจตัวเลขที่กรอก — กรอบกรอกด้านเดียวหรือทั้งสองด้านได้
function draftCheck(m) {
  if (isBox(m)) {
    const w = parseLength(m.draft?.raw ?? '', state.unit);
    const hh = parseLength(m.draft?.rawH ?? '', state.unit);
    if (!w.ok) return { ok: false, error: `ความกว้าง: ${w.error}` };
    if (!hh.ok) return { ok: false, error: `ความสูง: ${hh.error}` };
    if (w.value == null && hh.value == null) return { ok: false, error: 'กรอกความกว้างหรือความสูงจริงอย่างน้อย 1 ด้าน' };
    return { ok: true };
  }
  const r = parseLength(m.draft?.raw ?? '', state.unit);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.value == null) return { ok: false, error: 'กรอกขนาดจริงของระยะนี้' };
  return { ok: true };
}

function confirmMeasure(id) {
  const m = measureOf(id);
  const r = draftCheck(m);
  if (!r.ok) {
    toast(r.error, 'warn');
    return;
  }
  const raw = String(m.draft.raw ?? '').trim();
  const rawH = String(m.draft.rawH ?? '').trim();
  // ตัวเลขไม่เปลี่ยน = ที่มาเดิม (เช่น ขนาดแนะนำ) · พิมพ์ใหม่ = ขนาดจากลูกค้า
  const same = m.confirm && m.confirm.raw.trim() === raw && (!isBox(m) || String(m.confirm.rawH ?? '').trim() === rawH);
  const source = same ? m.confirm.source : 'customer';
  m.confirm = isBox(m) ? { raw, rawH, source } : { raw, source };
  m.draft = null;
  // กรอบ: ด้านที่ยืนยันแสดงในภาพให้ (ด้านอื่นคงตามที่ผู้ใช้เลือก)
  if (isBox(m)) {
    if (raw) m.showW = true;
    if (rawH) m.showH = true;
  }
  if (!state.mainId) state.mainId = id;
  redraw();
  toast(`ยืนยันขนาด "${titleOf(m)}" แล้ว — ล็อกตัวเลขและตำแหน่งไว้`);
}

function startEdit(id) {
  const m = measureOf(id);
  m.draft = { raw: m.confirm.raw, ...(isBox(m) ? { rawH: m.confirm.rawH ?? '' } : {}), ...geomOf(m) };
  redraw();
}

// ยกเลิกการแก้ไข: ตำแหน่งและตัวเลขกลับเป็นค่าที่ยืนยันไว้
function cancelEdit(id) {
  const m = measureOf(id);
  if (m.draft && m.confirm) {
    const { raw, rawH, ...g } = m.draft;
    Object.assign(m, g);
  }
  m.draft = null;
  redraw();
}

// เลิกใช้ขนาดที่ยืนยัน (ผู้ใช้กดเอง) — ถ้าเป็นเส้นหลัก ใช้เส้นที่ยืนยันลำดับแรกที่เหลือ และแจ้งให้รู้
function unconfirmMeasure(id) {
  const m = measureOf(id);
  m.confirm = null;
  m.draft = null;
  if (state.mainId === id) {
    state.mainId = nextMainId(measuresAsParts(state.measures, toCm), id);
    if (state.mainId) toast(`เส้นหลักที่ใช้คำนวณเปลี่ยนเป็น "${titleOf(measureOf(state.mainId))}"`, 'warn');
  }
  redraw();
}

function setMain(id) {
  state.mainId = id;
  redraw();
  toast(`ใช้ "${titleOf(measureOf(id))}" เป็นเส้นหลักในการคำนวณ`);
}

// "จัดเส้นวัดให้อ่านง่าย": ด้านของเส้นบอกขนาดกลับเป็นอัตโนมัติ — ไม่เปลี่ยนขนาดหรือตำแหน่งที่วัด · เส้นที่ล็อกตำแหน่งไม่ย้าย
function arrangeDims() {
  const r = arrangeSides(state.measures);
  state.measures = r.measures;
  redraw();
  const pinned = r.pinned ? ` · ไม่ย้ายเส้นที่ล็อกตำแหน่งไว้ ${r.pinned} รายการ` : '';
  toast(`${r.moved ? `จัดตำแหน่งเส้นบอกขนาดใหม่ ${r.moved} รายการ` : 'เส้นบอกขนาดจัดอัตโนมัติอยู่แล้ว'} — ขนาดที่วัดไม่เปลี่ยน${pinned}`);
}

async function deleteMeasure(id) {
  const m = measureOf(id);
  if (m.confirm && !(await confirmDialog({ title: 'ลบเส้นที่ยืนยันขนาดแล้ว?', message: `"${titleOf(m)}" มีขนาดจริงที่ยืนยันไว้ — ลบแล้วต้องยืนยันใหม่`, okLabel: 'ลบเส้น', danger: true }))) return;
  state.measures = state.measures.filter((x) => x.id !== id);
  state.selectedId = null;
  if (state.mainId === id) {
    state.mainId = nextMainId(measuresAsParts(state.measures, toCm), id);
    if (state.mainId) toast(`เส้นหลักที่ใช้คำนวณเปลี่ยนเป็น "${titleOf(measureOf(state.mainId))}"`, 'warn');
  }
  redraw();
}

// ปรับทีละนิด (จอสัมผัส): ปลายเส้นแต่ละข้าง หรือเลื่อนทั้งเส้น ทีละ 0.25% ของภาพ (อย่างน้อย 1 px)
function nudge(key, dir) {
  const m = measureOf(state.selectedId);
  if (!m || isLocked(m) || isBox(m)) return;
  const step = Math.max(1, Math.round(Math.max(state.img.width, state.img.height) / 400));
  const maxAlong = m.axis === 'x' ? state.img.width : state.img.height;
  const maxCross = m.axis === 'x' ? state.img.height - 1 : state.img.width - 1;
  if (key === 'a') m.a = Math.max(0, Math.min(m.b - 1, m.a + dir * step));
  if (key === 'b') m.b = Math.min(maxAlong, Math.max(m.a + 1, m.b + dir * step));
  if (key === 'at') m.at = Math.max(0, Math.min(maxCross, m.at + dir * step));
  redraw();
}

// ---------------------------------------------------------------- งานที่บันทึกไว้

const cleanMeasures = () => state.measures.map(({ draft, ...m }) => m);
// ข้อมูลที่ใช้บอกว่ามีการแก้ไขหลังบันทึก (ไม่รวมภาพ — เปิดภาพใหม่ชื่อไฟล์จะเปลี่ยนด้วย)
function fingerprintOf() {
  const pick = ['fileName', 'unit', 'mainId', 'trialOn', 'trialRaw', 'box', 'manualBox', 'removeBackground', 'tolerance', 'lineTheme', 'jobName', 'snap', 'bounds'];
  return JSON.stringify([cleanMeasures(), ...pick.map((k) => state[k])]);
}
const isDirty = () => Boolean(state.img) && fingerprintOf() !== state.savedFp;

function thumbnail() {
  const max = 160;
  const k = Math.min(1, max / Math.max(view.stageCanvas.width, view.stageCanvas.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(view.stageCanvas.width * k)), height: Math.max(1, Math.round(view.stageCanvas.height * k)) });
  c.getContext('2d').drawImage(view.stageCanvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

function toJob() {
  const cur = current();
  const keep = (d) => (d && d.value != null ? d : null);
  return {
    // ข้อมูลรุ่นเดิมของงานที่เปิด (ถ้ามี) — เก็บคืนตามเดิม
    ...(state.legacy || {}),
    version: 4,
    id: state.jobId || newId(),
    name: state.jobName.trim(),
    image: { name: state.fileName, dataUrl: state.imageDataUrl, width: state.img.width, height: state.img.height },
    thumb: thumbnail(),
    measures: cleanMeasures(),
    ...Object.fromEntries(['unit', 'mainId', 'nextMeasure', 'trialOn', 'trialRaw', 'box', 'manualBox', 'removeBackground', 'tolerance', 'lineTheme', 'snap', 'bounds'].map((k) => [k, state[k]])),
    results: cur && !cur.missing
      ? { sign: { width: keep(cur.sign.width), height: keep(cur.sign.height) }, measures: state.measures.map((m) => (isBox(m)
        ? { id: m.id, value: keep(cur.values(m).width), height: keep(cur.values(m).height) }
        : { id: m.id, value: keep(cur.value(m)) })) }
      : { sign: {}, measures: [] },
  };
}

async function saveJob() {
  if (!state.img) return;
  try {
    const summary = await api().dimensionJobs.save(toJob());
    state.jobId = summary.id;
    state.savedFp = fingerprintOf();
    toast('บันทึกงานแล้ว — เปิดแก้ไขได้จาก "งานที่บันทึกไว้"');
    await loadJobs();
    redraw();
  } catch (err) {
    toastError(err, 'บันทึกงานไม่สำเร็จ');
  }
}

async function loadJobs() {
  try {
    const r = await api().dimensionJobs.list();
    jobsView.items = r.items;
    jobsView.loaded = true;
  } catch (err) {
    jobsView.items = [];
    toastError(err, 'อ่านรายการงานไม่สำเร็จ');
  }
  if (view) renderJobs();
}

async function leaveCurrent() {
  if (!isDirty()) return true;
  return confirmDialog({ title: 'งานนี้ยังไม่ได้บันทึก', message: 'ถ้าเปิดงานอื่นหรือเริ่มงานใหม่ การแก้ไขที่ยังไม่บันทึกจะหายไป', okLabel: 'ทำต่อโดยไม่บันทึก' });
}

async function openJob(id) {
  if (!(await leaveCurrent())) return;
  try {
    const job = await api().dimensionJobs.get(id);
    if (!job) throw new Error('ไม่พบงานนี้');
    const img = await decodeFile(dataUrlToBlob(job.image.dataUrl));
    state = Object.assign(freshState(), {
      jobId: job.id, jobName: job.name, fileName: job.image.name, imageDataUrl: job.image.dataUrl, img,
      legacy: { items: job.items, widthRaw: job.widthRaw, heightRaw: job.heightRaw, signConfirmed: job.signConfirmed, sizeSource: job.sizeSource, signShowW: job.signShowW, signShowH: job.signShowH, nextItem: job.nextItem },
      unit: job.unit, measures: job.measures.map((m) => ({ ...m, draft: null })), nextMeasure: job.nextMeasure, mainId: job.mainId,
      trialOn: job.trialOn, trialRaw: job.trialRaw, manualBox: job.manualBox && Boolean(job.box), box: job.box,
      tolerance: job.tolerance, lineTheme: job.lineTheme, snap: job.snap, bounds: job.bounds === true,
    });
    analyze();
    // การตัดสินใจเรื่องพื้นหลังที่บันทึกไว้ (เฉพาะพื้นหลังทึบ — แบบอื่นระบบกำหนดเอง)
    if (state.background.kind === 'solid') state.removeBackground = job.removeBackground;
    state.savedFp = fingerprintOf();
    redraw();
    window.scrollTo?.(0, 0);
    toast(`เปิดงาน "${job.name || job.image.name}" แล้ว`);
  } catch (err) {
    toastError(err, 'เปิดงานไม่สำเร็จ');
  }
}

async function deleteJob(item) {
  const ok = await confirmDialog({ title: 'ลบงานนี้?', message: `"${item.name}" จะถูกลบออกจากรายการงานภาพแสดงขนาด (ไม่กระทบโครงการออกแบบป้าย)`, okLabel: 'ลบงาน', danger: true });
  if (!ok) return;
  try {
    await api().dimensionJobs.delete(item.id);
    if (state.jobId === item.id) state.jobId = null;
    toast('ลบงานแล้ว');
    await loadJobs();
  } catch (err) {
    toastError(err, 'ลบงานไม่สำเร็จ');
  }
}

async function newJob() {
  if (!(await leaveCurrent())) return;
  state = freshState();
  redraw();
}

// ---------------------------------------------------------------- วาดหน้าจอ

function section(no, title, hint, body, attrs = {}) {
  return h('section', { class: 'qs-section sd-step', ...attrs },
    h('div', { class: 'sec-head' }, h('div', { class: 'sec-no' }, String(no)),
      h('div', {}, h('div', { class: 'sec-title' }, title), hint ? h('div', { class: 'sec-hint' }, hint) : null)),
    body);
}

function kindBadge(source) {
  const k = KIND[source];
  if (!k) return null;
  return h('span', { class: `sd-kind ${k.cls}`, 'data-kind': source }, h('span', { class: 'sd-kind-dot' }), k.label);
}

function redraw() {
  if (!view) return;
  const cur = current();
  renderJobs();
  renderSteps(cur);
  renderFile();
  renderTools();
  renderStage();
  renderBackground();
  renderPanel(cur);
  renderKnown(cur);
  renderMeasure(cur);
  renderPreview(cur);
  renderMore(cur);
}

function renderSteps(cur) {
  const ready = Boolean(cur && !cur.missing);
  const done = [
    Boolean(state.img),
    state.measures.length > 0,
    ready,
    ready && shownItems(cur).length > 0,
    Boolean(state.jobId) && !isDirty(),
  ];
  const active = done.indexOf(false);
  view.steps.replaceChildren(...['อัปโหลดภาพ', 'ลากกรอบหรือเส้น', 'กรอกขนาดจริง', 'เลือกขนาดที่แสดง', 'ดาวน์โหลด / บันทึก'].map((t, i) => h('div', {
    class: `sd-step-pill ${done[i] ? 'done' : ''} ${i === (active < 0 ? 4 : active) ? 'now' : ''}`, 'data-step-pill': String(i + 1),
  }, h('span', { class: 'sd-step-no' }, done[i] ? icon('check') : String(i + 1)), t)));
}

function renderJobs() {
  const list = jobsView.items;
  view.jobsCount.textContent = jobsView.loaded ? `(${list.length})` : '';
  view.jobsBody.classList.toggle('hidden', !jobsView.open);
  view.jobsToggle.setAttribute('aria-expanded', String(jobsView.open));
  view.jobsToggle.replaceChildren(icon('chevron', jobsView.open ? 'rot180' : ''), jobsView.open ? 'ซ่อนรายการ' : 'แสดงรายการ');
  view.jobsBody.replaceChildren(...(list.length
    ? [h('ul', { class: 'sd-jobs', 'data-testid': 'dimension-jobs' }, ...list.map((j) => h('li', { class: `sd-job ${state.jobId === j.id ? 'current' : ''}`, 'data-job': j.id },
      j.thumb ? h('img', { class: 'sd-job-thumb sd-checker', src: j.thumb, alt: '' }) : h('span', { class: 'sd-job-thumb' }, icon('image')),
      h('div', { class: 'sd-job-text' },
        h('div', { class: 'sd-job-name' }, j.name),
        h('div', { class: 'muted small' }, `${j.measureCount ?? 0} รายการวัด · ยืนยัน ${j.confirmedCount ?? 0} · ${formatDate(j.updatedAt)}`)),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm', 'data-action': 'open-dimension-job', onclick: () => openJob(j.id) }, icon('folder'), 'เปิด'),
        h('button', { class: 'btn btn-sm btn-ghost btn-icon', 'aria-label': `ลบงาน ${j.name}`, 'data-action': 'delete-dimension-job', onclick: () => deleteJob(j) }, icon('trash'))))))]
    : [h('div', { class: 'muted small', 'data-testid': 'dimension-jobs-empty' }, 'ยังไม่มีงานที่บันทึกไว้')]));
}

function renderFile() {
  view.fileInfo.replaceChildren(...(state.img
    ? [icon('image'), h('span', { 'data-testid': 'file-name' }, state.fileName), h('span', { class: 'muted small' }, `${state.img.width} × ${state.img.height} px · ไฟล์ต้นฉบับไม่ถูกแก้ไข`)]
    : []));
  view.fileInfo.classList.toggle('hidden', !state.img);
  view.dropzone.classList.toggle('sd-dropzone-small', Boolean(state.img));
  view.stageCard.classList.toggle('hidden', !state.img);
  view.rightCol.classList.toggle('hidden', !state.img);
}

// เครื่องมือ: ▭ ลากกรอบ (หลัก) · เส้น ↔ ↕ ⇤⇥ (เสริม) + ตัวช่วยจับขอบ
function renderTools() {
  const btn = ([k, label]) => h('button', {
    class: state.tool === k ? 'on' : '', role: 'radio', 'aria-checked': String(state.tool === k), 'data-tool': k,
    onclick: () => { state.tool = k; renderTools(); },
  }, label);
  view.tools.replaceChildren(
    h('div', { class: 'segmented sd-tool-seg sd-tool-main', role: 'radiogroup', 'aria-label': 'เครื่องมือวัดหลัก' }, btn(BOX_TOOL)),
    h('span', { class: 'muted small sd-tool-or' }, 'หรือวัดเป็นเส้น'),
    h('div', { class: 'segmented sd-tool-seg', role: 'radiogroup', 'aria-label': 'เครื่องมือวัดเป็นเส้น' }, ...TOOLS.map(btn)),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.snap, 'data-action': 'toggle-snap', onchange: (e) => { state.snap = e.target.checked; } }), 'ช่วยจับขอบ'),
  );
}

function renderStage() {
  if (!state.img) return;
  const { rgba, width, height } = state.img;
  view.stageCanvas.width = width;
  view.stageCanvas.height = height;
  const ctx = view.stageCanvas.getContext('2d');
  const shown = new ImageData(new Uint8ClampedArray(rgba), width, height);
  // ส่วนที่จะถูกลบ (พื้นหลังที่ต่อกับขอบภาพ) — แสดงเป็นลายตารางเพื่อให้ผู้ใช้ตรวจ
  if (state.background.kind === 'solid' && state.removeBackground !== false) {
    for (let p = 0; p < width * height; p += 1) if (state.mask[p]) shown.data[p * 4 + 3] = 0;
  }
  ctx.putImageData(shown, 0, 0);
  renderOverlays();
}

// ป้ายบนเส้น: ชื่อ/ชนิด + ค่า (ยืนยันแล้วมีกุญแจ · เส้นหลักมีดาว)
function tagText(m, cur) {
  const num = (v) => (v && v.value != null ? `${v.source === 'estimated' ? '≈' : ''}${formatLength(v.value, state.unit)}` : '');
  let val = '';
  if (cur && !cur.missing) {
    if (isBox(m)) {
      const v = cur.values(m);
      val = v.width.value != null ? ` ${num(v.width)} × ${num(v.height)}` : '';
    } else {
      const v = num(cur.value(m));
      val = v ? ` ${v}` : '';
    }
  }
  return `${isLocked(m) ? '🔒 ' : ''}${state.mainId === m.id ? '★ ' : ''}${titleOf(m)}${val}`;
}

// เส้นวัดบนภาพ — เส้นที่เลือกและไม่ล็อกมีจุดจับที่ปลายทั้งสองข้าง
function renderOverlays(preview = null) {
  const cur = current();
  const pct = (v, total) => `${(v / total) * 100}%`;
  const W = state.img.width;
  const H = state.img.height;
  const place = (el, m) => Object.assign(el.style, m.axis === 'x'
    ? { left: pct(m.a, W), width: pct(m.b - m.a, W), top: pct(m.at, H) }
    : { top: pct(m.a, H), height: pct(m.b - m.a, H), left: pct(m.at, W) });
  const lineEl = (m) => {
    const sel = m.id === state.selectedId;
    const lock = isLocked(m);
    const el = h('div', {
      class: `sd-line sd-line-${m.axis} ${m.type === 'gap' ? 'gap' : ''} ${sel ? 'sel' : ''} ${m.confirm ? 'ok' : ''} ${lock ? 'locked' : ''} ${state.mainId === m.id ? 'main' : ''} ${m.hidden ? 'off' : ''}`,
      'data-measure': m.id, 'data-testid': `line-${m.id}`,
    },
    h('span', { class: 'sd-line-tag' }, tagText(m, cur)),
    // ปลายเส้นสองข้าง (ปรับความยาว) + ที่จับกลางเส้น (ย้ายทั้งเส้น) — ลากที่อื่นบนภาพ = วัดเส้นใหม่เสมอ
    ...(sel && !lock ? [...['a', 'b'].map((k) => h('span', { class: 'sd-handle', 'data-h': k })), h('span', { class: 'sd-handle sd-grip', 'data-h': 'm', title: 'ลากเพื่อย้ายเส้น' })] : []));
    place(el, m);
    return el;
  };
  const placeBox = (el, m) => Object.assign(el.style, { left: pct(m.x, W), top: pct(m.y, H), width: pct(m.w, W), height: pct(m.h, H) });
  // กรอบ: เส้นประบนหน้าจอเท่านั้น (ไม่อยู่ในภาพที่ส่งออก) · กรอบที่เลือกและไม่ล็อก: มุมทั้งสี่ = ปรับขนาด · จุดกลาง = ย้าย
  const boxEl = (m) => {
    const sel = m.id === state.selectedId;
    const lock = isLocked(m);
    const el = h('div', {
      class: `sd-box ${sel ? 'sel' : ''} ${m.confirm ? 'ok' : ''} ${lock ? 'locked' : ''} ${state.mainId === m.id ? 'main' : ''} ${m.hidden ? 'off' : ''}`,
      'data-measure': m.id, 'data-testid': `box-${m.id}`,
    },
    h('span', { class: 'sd-line-tag' }, tagText(m, cur)),
    ...(sel && !lock ? [...['nw', 'ne', 'sw', 'se'].map((k) => h('span', { class: `sd-handle sd-corner sd-corner-${k}`, 'data-h': k })), h('span', { class: 'sd-handle sd-grip', 'data-h': 'm', title: 'ลากเพื่อย้ายกรอบ' })] : []));
    placeBox(el, m);
    return el;
  };
  // กรอบใหญ่อยู่ล่าง → แตะกรอบเล็ก/เส้นที่อยู่ในกรอบใหญ่ได้
  const boxes = state.measures.filter(isBox).sort((a, b) => b.w * b.h - a.w * a.h);
  const els = [...boxes.map(boxEl), ...state.measures.filter((m) => !isBox(m)).map(lineEl)];
  if (preview) {
    const d = isBox(preview) ? h('div', { class: 'sd-box draft' }) : h('div', { class: `sd-line sd-line-${preview.axis} draft` });
    if (isBox(preview)) placeBox(d, preview);
    else place(d, preview);
    els.push(d);
  }
  view.overlayLayer.replaceChildren(...els);
  const m = measureOf(state.selectedId);
  view.boxInfo.textContent = m
    ? `${titleOf(m)}: ${isBox(m) ? `${m.w} × ${m.h}` : lineLength(m)} px`
    : `ทั้งป้าย: ${state.box.width} × ${state.box.height} px${state.manualBox ? ' (ปรับเอง)' : ' (อัตโนมัติ — ไม่รวมพื้นที่ว่างของไฟล์)'}`;
}

function renderBackground() {
  const bg = state.background;
  view.bgBody.classList.toggle('hidden', !bg || bg.kind === 'transparent');
  if (!bg || bg.kind === 'transparent') return;
  const warnings = backgroundWarnings(state.img.rgba, state.img.width, state.img.height, bg, state.mask, state.box, { tolerance: state.tolerance }).filter((w) => w.code !== 'solid');
  const items = warnings.map((w) => h('div', { class: 'notice notice-warn', 'data-code': w.code }, icon('alert'), h('div', {}, w.message)));
  if (bg.kind === 'solid') {
    const status = state.removeBackground === null
      ? 'ภาพมีพื้นหลังติดมา — ตรวจลายตารางบนภาพ (ส่วนที่จะลบ) แล้วเลือก'
      : state.removeBackground ? 'ลบพื้นหลังสีเดียวออกแล้ว (ลายตารางบนภาพ)' : 'ไม่ลบพื้นหลัง (นอกกรอบป้ายเป็นโปร่งใส)';
    items.push(
      h('div', { class: 'muted small', 'data-testid': 'bg-status', 'data-code': 'solid' }, status),
      h('div', { class: 'row' },
        h('button', { class: `btn btn-sm ${state.removeBackground === true ? 'btn-primary' : ''}`, 'data-action': 'remove-bg', onclick: () => { state.removeBackground = true; redraw(); } }, 'ลบพื้นหลัง'),
        h('button', { class: `btn btn-sm ${state.removeBackground === false ? 'btn-primary' : ''}`, 'data-action': 'keep-bg', onclick: () => { state.removeBackground = false; redraw(); } }, 'ไม่ลบพื้นหลัง')),
    );
  }
  view.bgBody.replaceChildren(...items);
}

// ---------------------------------------------------------------- แผงเส้นที่เลือก

function renderPanel(cur) {
  const m = measureOf(state.selectedId);
  view.panel.classList.toggle('hidden', !state.img || !m);
  if (!state.img || !m) return;
  if (isBox(m)) {
    renderBoxPanel(cur, m);
    return;
  }
  const lock = isLocked(m);
  const v = cur && !cur.missing ? cur.value(m) : null;
  const unitShort = LENGTH_UNITS[state.unit].label;

  const head = h('div', { class: 'row sd-panel-head' },
    h('span', { class: `sd-line-kind ${m.type === 'gap' ? 'gap' : ''}`, 'data-testid': 'line-kind' }, measureKindLabel(m)),
    h('input', { class: 'input input-sm sd-panel-name', value: m.name, list: 'sd-names', placeholder: 'ชื่อ (ไม่บังคับ) เช่น ชื่อร้าน', 'aria-label': 'ชื่อเส้นวัด', 'data-field': 'line-name', oninput: (e) => {
      m.name = e.target.value;
      renderOverlays();
      renderKnown(current());
      renderMeasure(current());
    } }),
    state.mainId === m.id ? h('span', { class: 'sd-main-badge', 'data-testid': 'main-badge' }, '★ เส้นหลัก') : null,
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'ปิด', 'data-action': 'deselect', onclick: () => { state.selectedId = null; redraw(); } }, icon('x')));

  let sizeBlock;
  if (lock) {
    sizeBlock = h('div', { class: 'stack sd-tight', 'data-testid': 'part-locked' },
      h('div', { class: 'sd-status' }, kindBadge(v?.source === 'user' ? 'user' : v?.source || 'user'), h('b', { 'data-testid': 'part-size' }, ` ${v && v.value != null ? plain(v) : ''}`)),
      h('div', { class: 'muted small' }, state.mainId === m.id ? 'ล็อกไว้ — เส้นอื่นคำนวณจากเส้นนี้' : 'ล็อกไว้ — เพิ่ม ลบ หรือแก้เส้นอื่นไม่กระทบขนาดนี้'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm', 'data-action': 'edit-size', onclick: () => startEdit(m.id) }, icon('edit'), 'แก้ไข'),
        state.mainId !== m.id ? h('button', { class: 'btn btn-sm btn-ghost', 'data-action': 'set-main', onclick: () => setMain(m.id) }, '★ ใช้เป็นเส้นหลัก') : null));
  } else {
    sizeBlock = h('div', { class: 'stack sd-tight' },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, m.confirm ? `แก้ไขขนาดจริง (${unitShort})` : `รู้ขนาดจริงของระยะนี้? (${unitShort}) — ไม่รู้ เว้นว่างได้`),
        h('input', { class: 'input', inputmode: 'decimal', placeholder: 'เช่น 35', value: m.draft?.raw ?? '', 'data-field': 'measure-raw', oninput: (e) => {
          m.draft = { ...(m.draft || {}), raw: e.target.value };
          const btn = view.panel.querySelector('[data-action="confirm-size"]');
          if (btn) btn.disabled = !draftCheck(m).ok;
        } })),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm btn-primary', 'data-action': 'confirm-size', disabled: !draftCheck(m).ok, onclick: () => confirmMeasure(m.id) }, icon('lock'), 'ยืนยันขนาดจริง'),
        m.confirm ? h('button', { class: 'btn btn-sm', 'data-action': 'cancel-edit', onclick: () => cancelEdit(m.id) }, 'ยกเลิก') : null,
        m.confirm ? h('button', { class: 'btn btn-sm btn-ghost', 'data-action': 'unconfirm', onclick: () => unconfirmMeasure(m.id) }, 'เลิกใช้ขนาดนี้') : null),
      v && v.value != null && !m.confirm ? h('div', { class: 'sd-status', 'data-testid': 'part-calc' }, kindBadge(v.source), h('b', {}, ` ${v.source === 'estimated' ? '≈ ' : ''}${plain(v)}`)) : null);
  }

  const tools = lock ? null : h('div', { class: 'row' },
    h('button', { class: 'btn btn-sm', 'data-action': 'snap-line', onclick: snapSelected }, icon('layout'), 'จับขอบตัวอักษร'),
    m.drawn ? h('button', { class: 'btn btn-sm', 'data-action': 'undo-snap', onclick: undoSnap }, icon('refresh'), 'ใช้ตามที่ลาก') : null,
    h('button', { class: 'btn btn-sm btn-ghost sd-danger-text', 'data-action': 'delete-line', onclick: () => deleteMeasure(m.id) }, icon('trash'), 'ลบ'));
  const [s1, s2, mv1, mv2] = m.axis === 'x' ? ['ปลายซ้าย', 'ปลายขวา', '↑', '↓'] : ['ปลายบน', 'ปลายล่าง', '←', '→'];
  const nb = (label, aria, key, dir) => h('button', { class: 'btn btn-sm sd-nudge-btn', 'aria-label': aria, 'data-nudge': `${key}${dir > 0 ? '+' : '-'}`, onclick: () => nudge(key, dir) }, label);
  const nudgeBox = lock ? null : fold('nudge', 'ปรับเส้นทีละนิด (ปุ่ม)', h('div', { class: 'sd-nudge-grid', 'data-testid': 'nudge' },
    nb(`${s1} −`, `${s1} เลื่อนเข้า/ออก`, 'a', -1), nb(`${s1} +`, `${s1} อีกทาง`, 'a', 1),
    nb(`${s2} −`, `${s2} เลื่อนเข้า/ออก`, 'b', -1), nb(`${s2} +`, `${s2} อีกทาง`, 'b', 1),
    nb(`เลื่อนเส้น ${mv1}`, 'เลื่อนทั้งเส้น', 'at', -1), nb(`เลื่อนเส้น ${mv2}`, 'เลื่อนทั้งเส้นอีกทาง', 'at', 1)));
  const sides = m.axis === 'x' ? [['auto', 'อัตโนมัติ'], ['top', 'บน'], ['bottom', 'ล่าง']] : [['auto', 'อัตโนมัติ'], ['left', 'ซ้าย'], ['right', 'ขวา']];
  const lines = fold('lines', 'ตำแหน่งในภาพ', h('div', { class: 'stack sd-tight' },
    h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'ด้านของเส้นในภาพ' }, ...sides.map(([k, l]) => h('button', {
      class: (m.side || 'auto') === k ? 'on' : '', role: 'radio', 'aria-checked': String((m.side || 'auto') === k), 'data-side': k, onclick: () => { m.side = k; redraw(); },
    }, l))),
    pinCheck(m),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: m.hidden, 'data-toggle': 'hidden', onchange: (e) => { m.hidden = e.target.checked; redraw(); } }), 'ไม่แสดงเส้นนี้ในภาพที่ดาวน์โหลด')));

  view.panel.replaceChildren(...[head, sizeBlock, tools, nudgeBox, lines].filter(Boolean));
}

// ล็อกตำแหน่งของเส้นบอกขนาดในภาพ — "จัดเส้นวัดให้อ่านง่าย" จะไม่ย้ายเส้นนี้
const pinCheck = (m) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: Boolean(m.pin), 'data-toggle': 'pin', onchange: (e) => { m.pin = e.target.checked; redraw(); } }), 'ล็อกตำแหน่งในภาพ (ปุ่มจัดเส้นวัดจะไม่ย้าย)');

// แผงกรอบที่เลือก: ① ขนาดจริงที่รู้ (กว้าง/สูง ด้านเดียวหรือทั้งคู่) ② แสดงด้านใดในภาพ ③ จับขอบ/ลบ ④ ตำแหน่งเส้น (พับไว้)
function renderBoxPanel(cur, m) {
  const lock = isLocked(m);
  const v = cur && !cur.missing ? cur.values(m) : null;
  const u = unitLabel();
  const head = h('div', { class: 'row sd-panel-head' },
    h('span', { class: 'sd-line-kind sd-kind-box', 'data-testid': 'line-kind' }, 'กรอบ'),
    h('input', { class: 'input input-sm sd-panel-name', value: m.name, list: 'sd-names', placeholder: 'ชื่อ (ไม่บังคับ) เช่น ทั้งป้าย', 'aria-label': 'ชื่อกรอบ', 'data-field': 'line-name', oninput: (e) => {
      m.name = e.target.value;
      renderOverlays();
      renderKnown(current());
      renderMeasure(current());
    } }),
    state.mainId === m.id ? h('span', { class: 'sd-main-badge', 'data-testid': 'main-badge' }, '★ ส่วนหลัก') : null,
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'ปิด', 'data-action': 'deselect', onclick: () => { state.selectedId = null; redraw(); } }, icon('x')));

  const valText = (d) => (d && d.value != null ? `${d.source === 'estimated' ? '≈ ' : ''}${plain(d)}` : '—');
  let sizeBlock;
  if (lock) {
    const c = m.confirm;
    sizeBlock = h('div', { class: 'stack sd-tight', 'data-testid': 'part-locked' },
      h('div', { class: 'sd-status' }, kindBadge(c.source === 'suggested' ? 'suggested' : c.source === 'unknown' ? 'unknown' : 'user'),
        h('b', { 'data-testid': 'part-size' }, ` กว้าง ${valText(v?.width)} × สูง ${valText(v?.height)}`)),
      h('div', { class: 'muted small' }, `${state.mainId === m.id ? 'ล็อกไว้ — ส่วนอื่นคำนวณจากกรอบนี้' : 'ล็อกไว้ — เพิ่ม ลบ หรือแก้ส่วนอื่นไม่กระทบขนาดนี้'}${c.raw && c.rawH ? '' : ' · ด้านที่ไม่ได้กรอกคำนวณจากภาพ (≈)'}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm', 'data-action': 'edit-size', onclick: () => startEdit(m.id) }, icon('edit'), 'แก้ไข'),
        state.mainId !== m.id ? h('button', { class: 'btn btn-sm btn-ghost', 'data-action': 'set-main', onclick: () => setMain(m.id) }, '★ ใช้เป็นส่วนหลัก') : null));
  } else {
    const field = (key, label, ph, testid) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label),
      h('input', { class: 'input', inputmode: 'decimal', placeholder: ph, value: m.draft?.[key] ?? '', 'data-field': testid, oninput: (e) => {
        m.draft = { ...(m.draft || {}), [key]: e.target.value };
        const btn = view.panel.querySelector('[data-action="confirm-size"]');
        if (btn) btn.disabled = !draftCheck(m).ok;
      } }));
    sizeBlock = h('div', { class: 'stack sd-tight' },
      h('div', { class: 'field-label' }, m.confirm ? `แก้ไขขนาดจริง (${u})` : `รู้ขนาดจริง? กรอกด้านที่รู้ (${u}) — ด้านเดียวก็ได้ · ไม่รู้ เว้นว่าง`),
      h('div', { class: 'sd-inputs' }, field('raw', 'ความกว้าง', 'เช่น 836', 'box-w'), field('rawH', 'ความสูง', 'เช่น 400', 'box-h')),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm btn-primary', 'data-action': 'confirm-size', disabled: !draftCheck(m).ok, onclick: () => confirmMeasure(m.id) }, icon('lock'), 'ยืนยันขนาดจริง'),
        m.confirm ? h('button', { class: 'btn btn-sm', 'data-action': 'cancel-edit', onclick: () => cancelEdit(m.id) }, 'ยกเลิก') : null,
        m.confirm ? h('button', { class: 'btn btn-sm btn-ghost', 'data-action': 'unconfirm', onclick: () => unconfirmMeasure(m.id) }, 'เลิกใช้ขนาดนี้') : null),
      v && v.width.value != null && !m.confirm
        ? h('div', { class: 'sd-status', 'data-testid': 'part-calc' }, kindBadge(v.width.source), h('b', {}, ` กว้าง ${valText(v.width)} × สูง ${valText(v.height)}`))
        : null);
  }

  // แสดงด้านใดในภาพ — กดเลือกเอง (ไม่แสดงทั้งสองด้านอัตโนมัติ)
  const showBtn = (key, label) => h('button', {
    class: `btn btn-sm sd-show ${m[key] ? 'on' : ''}`, 'aria-pressed': String(Boolean(m[key])), 'data-show': key === 'showW' ? 'w' : 'h',
    onclick: () => { m[key] = !m[key]; redraw(); },
  }, m[key] ? icon('check') : null, label);
  const show = h('div', { class: 'stack sd-tight', 'data-testid': 'box-show' },
    h('div', { class: 'field-label' }, 'แสดงในภาพที่ดาวน์โหลด'),
    h('div', { class: 'row' }, showBtn('showW', 'ความกว้าง'), showBtn('showH', 'ความสูง')),
    !m.showW && !m.showH ? h('div', { class: 'muted small', 'data-testid': 'box-show-none' }, 'ยังไม่แสดงขนาดของกรอบนี้ในภาพ — กดเลือกด้านที่ต้องการ') : null);

  const tools = lock ? null : h('div', { class: 'row' },
    h('button', { class: 'btn btn-sm', 'data-action': 'snap-line', onclick: snapSelected }, icon('layout'), 'ช่วยจับขอบ'),
    m.drawn ? h('button', { class: 'btn btn-sm', 'data-action': 'undo-snap', onclick: undoSnap }, icon('refresh'), 'ใช้ตามที่ลาก') : null,
    h('button', { class: 'btn btn-sm btn-ghost sd-danger-text', 'data-action': 'delete-line', onclick: () => deleteMeasure(m.id) }, icon('trash'), 'ลบ'));

  const seg = (key, label, opts) => h('div', { class: 'field' }, h('span', { class: 'field-label' }, label),
    h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label }, ...opts.map(([k, l]) => h('button', {
      class: (m[key] || 'auto') === k ? 'on' : '', role: 'radio', 'aria-checked': String((m[key] || 'auto') === k), 'data-side': `${key}:${k}`, onclick: () => { m[key] = k; redraw(); },
    }, l))));
  const lines = fold('lines', 'ตำแหน่งเส้นบอกขนาดในภาพ', h('div', { class: 'stack sd-tight' },
    seg('sideW', 'ความกว้าง', [['auto', 'อัตโนมัติ'], ['top', 'บน'], ['bottom', 'ล่าง']]),
    seg('sideH', 'ความสูง', [['auto', 'อัตโนมัติ'], ['left', 'ซ้าย'], ['right', 'ขวา']]),
    pinCheck(m),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: m.hidden, 'data-toggle': 'hidden', onchange: (e) => { m.hidden = e.target.checked; redraw(); } }), 'ไม่แสดงกรอบนี้ในภาพที่ดาวน์โหลด')));

  view.panel.replaceChildren(...[head, sizeBlock, show, tools, lines].filter(Boolean));
}

// ---------------------------------------------------------------- ขั้นที่ 2 และ 3: รายการเส้น

function resultRow(m, cur) {
  if (isBox(m)) return boxRow(m, cur);
  const v = cur.value(m);
  const trial = Boolean(cur.trial) && v.source === 'user';
  return h('li', { class: `sd-res ${m.id === state.selectedId ? 'sel' : ''} ${m.hidden ? 'off' : ''}`, 'data-result': m.id, onclick: () => { state.selectedId = m.id; redraw(); } },
    h('b', {}, `${isLocked(m) ? '🔒 ' : ''}${titleOf(m)}`, state.mainId === m.id ? h('span', { class: 'sd-main-badge' }, ' ★ เส้นหลัก') : null, m.hidden ? h('span', { class: 'muted small' }, ' (ไม่แสดงในภาพ)') : null),
    h('div', { class: 'sd-res-line', 'data-testid': `res-${m.id}` }, kindBadge(trial ? 'trial' : v.source),
      h('span', {}, `${measureKindLabel(m)} ${v.value == null ? '—' : `${v.source === 'estimated' ? '≈ ' : ''}${plain(v)}`}`)));
}

// กรอบ: กว้าง × สูง พร้อมบอกว่าด้านไหนแสดงในภาพ
function boxRow(m, cur) {
  const v = cur.values(m);
  const one = (d, label, shown) => h('span', { class: `sd-res-side ${shown ? '' : 'off'}` },
    kindBadge(cur.trial && d.source === 'user' ? 'trial' : d.source),
    ` ${label} ${d.value == null ? '—' : `${d.source === 'estimated' ? '≈ ' : ''}${plain(d)}`}`, shown ? null : h('span', { class: 'muted small' }, ' (ไม่แสดง)'));
  return h('li', { class: `sd-res ${m.id === state.selectedId ? 'sel' : ''} ${m.hidden ? 'off' : ''}`, 'data-result': m.id, onclick: () => { state.selectedId = m.id; redraw(); } },
    h('b', {}, `${isLocked(m) ? '🔒 ' : ''}${titleOf(m)}`, state.mainId === m.id ? h('span', { class: 'sd-main-badge' }, ' ★ ส่วนหลัก') : null, m.hidden ? h('span', { class: 'muted small' }, ' (ไม่แสดงในภาพ)') : null),
    h('div', { class: 'sd-res-line sd-res-box', 'data-testid': `res-${m.id}` }, one(v.width, 'กว้าง', m.showW), one(v.height, 'สูง', m.showH)));
}

function warningText(w) {
  const name = titleOf(measureOf(w.id));
  const main = titleOf(measureOf(state.mainId));
  if (w.code === 'main-ratio') {
    return `สัดส่วนของ "${name}" ในภาพ ไม่ตรงกับความกว้าง × ความสูงที่ยืนยัน (ต่าง ${w.pct.toFixed(0)}%) — ระบบใช้ตัวเลขที่ยืนยันทั้งสองด้านตามเดิม ไม่ปรับให้เอง · ตรวจว่ากรอบครอบพอดีชิ้นงาน (กด "ช่วยจับขอบ") หรือภาพไม่ได้สัดส่วนเดียวกับแบบผลิต`;
  }
  return `"${name}" ในภาพ ≈ ${plain({ value: w.imageCm, source: 'estimated' })} แต่ยืนยันไว้ ${plain({ value: w.confirmedCm, source: 'user' })} (ต่าง ${w.pct.toFixed(0)}%) — ภาพไม่ได้สัดส่วนเดียวกับแบบผลิต ระบบใช้ตัวเลขที่ยืนยัน เส้นอื่นคำนวณจาก "${main}"`;
}

function renderKnown(cur) {
  if (!state.img) return;
  const list = state.measures.filter((m) => m.confirm);
  view.knownBody.replaceChildren(...[
    list.length && cur
      ? h('ul', { class: 'sd-results', 'data-testid': 'known-list' }, ...list.map((m) => resultRow(m, cur)))
      : h('div', { class: 'muted', 'data-testid': 'known-empty' }, 'ลากกรอบครอบป้าย (หรือลากเส้นตรงส่วนที่รู้ขนาด) แล้วกรอกขนาดจริง — กรอกด้านเดียวก็ได้'),
    cur && cur.warnings.length
      ? h('div', { class: 'stack sd-tight', 'data-testid': 'warnings' }, ...cur.warnings.map((w) => h('div', { class: 'notice notice-warn', 'data-warning': w.code, 'data-part': w.id }, icon('alert'), h('div', {}, warningText(w)))))
      : null,
  ].filter(Boolean));
}

function renderMeasure(cur) {
  if (!state.img) return;
  const list = state.measures.filter((m) => !m.confirm);
  const ready = cur && !cur.missing;
  view.measureBody.replaceChildren(...[
    !ready
      ? h('div', { class: 'muted small', 'data-testid': 'results-empty' }, 'ยืนยันขนาดจริงอย่างน้อย 1 รายการก่อน — ระบบจะไม่เดาตัวเลข')
      : list.length
        ? h('ul', { class: 'sd-results', 'data-testid': 'results' }, ...list.map((m) => resultRow(m, cur)))
        : h('div', { class: 'muted small' }, 'ลากกรอบหรือเส้นตรงส่วนอื่นที่ต้องการวัด — ขนาดขึ้นทันที'),
    ready && !state.measures.some((m) => m.overall) && !wholeBox()
      ? h('button', { class: 'link-btn', 'data-action': 'add-overall', onclick: addOverall }, icon('plus'), 'เพิ่มขนาดรวมทั้งป้าย')
      : null,
    cur?.trial ? h('div', { class: 'notice notice-info', 'data-testid': 'trial-note' }, icon('info'), h('div', {}, 'กำลังทดลองปรับขนาด — ตัวเลขชุดนี้ไม่ใช่ขนาดที่ยืนยัน และชื่อไฟล์ที่ดาวน์โหลดจะระบุว่า "ทดลองปรับ"')) : null,
  ].filter(Boolean));
  view.messages.replaceChildren(...(cur?.check.errors || []).map((e) => h('div', { class: 'field-error' }, e)));
  view.saveBtn.disabled = !cur || !cur.check.ok;
  renderSaveStatus();
}

function renderSaveStatus() {
  view.jobStatus.textContent = state.jobId ? (isDirty() ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'บันทึกแล้ว') : 'ยังไม่ได้บันทึกงานนี้';
  view.saveJobBtn.replaceChildren(icon('save'), state.jobId ? 'บันทึกงาน (ทับฉบับเดิม)' : 'บันทึกงาน');
}

// รายการที่แสดงในภาพที่ดาวน์โหลด: เส้นที่ไม่ซ่อน · กรอบเฉพาะด้านที่ผู้ใช้เลือกแสดง (เส้นกรอบเองไม่อยู่ในภาพ)
function shownItems(cur) {
  const out = [];
  for (const m of state.measures) {
    if (m.hidden) continue;
    if (isBox(m)) {
      const v = cur.values(m);
      const w = m.showW && v.width.value != null ? v.width : null;
      const hh = m.showH && v.height.value != null ? v.height : null;
      if (!w && !hh) continue;
      out.push({
        m, values: [w, hh].filter(Boolean),
        labelW: w ? lineLabel(w, state.unit) : '', labelH: hh ? lineLabel(hh, state.unit) : '',
        confirmedW: Boolean(m.confirm?.raw?.trim()), confirmedH: Boolean(m.confirm?.rawH?.trim()),
      });
    } else {
      const v = cur.value(m);
      if (v.value != null) out.push({ m, values: [v], label: lineLabel(v, state.unit), confirmed: Boolean(m.confirm) });
    }
  }
  return out;
}

// ภาพที่ดาวน์โหลด: เฉพาะขนาดที่ผู้ใช้เลือกแสดง — จัดวางอัตโนมัติ ไม่ทับกันและไม่ทับตัวป้าย · ระยะเดียวกันไม่แสดงซ้ำ
function renderPreview(cur) {
  lastResult = null;
  const ready = state.img && cur && !cur.missing;
  view.previewCard.classList.toggle('hidden', !ready);
  if (!ready) return;
  const items = shownItems(cur);
  const cropBox = cropOf(state.box, items.map((x) => x.m), state.img);
  const dims = lineDims(inkImage(), items, cropBox);
  // หมายเหตุรวมจุดเดียว (เฉพาะเมื่อมีค่าที่คำนวณ/แนะนำ/ไม่ระบุในภาพ)
  const notes = exportNotes(items.flatMap((x) => x.values));
  const layout = measureLayout({ crop: cropBox, dims, notes });
  const crop = cropPixels(state.img.rgba, state.img.width, cropBox, state.mask, state.removeBackground === true);
  const bounds = state.bounds ? boundsOf(inkImage(), items) : [];
  lastResult = renderMeasured({ crop, cropBox, signBox: state.box, layout, theme: state.lineTheme, bounds });
  lastResult.bounds = bounds;
  lastResult.cropBox = cropBox;
  lastResult.notes = notes;
  lastResult.canvas.dataset.testid = 'result-canvas';
  // พรีวิว = canvas เดียวกับที่ดาวน์โหลด · ลายตารางเป็นพื้นหลังของหน้าจอ (ส่วนโปร่งใสในไฟล์)
  view.previewWrap.className = `sd-result sd-checker ${state.lineTheme === 'light' ? 'sd-checker-dark' : ''}`;
  view.previewWrap.replaceChildren(lastResult.canvas);
  view.arrangeBtn.disabled = !items.length;
  view.boundsToggle.checked = state.bounds;
  view.previewHint.textContent = items.length ? '' : 'ยังไม่มีขนาดที่แสดงในภาพ — เลือกกรอบแล้วกด "ความกว้าง" หรือ "ความสูง" ในส่วน "แสดงในภาพที่ดาวน์โหลด"';
}

// ---------------------------------------------------------------- ตัวเลือกเพิ่มเติม (ซ่อนไว้)

// เปลี่ยนหน่วย = แปลงตัวเลขทุกช่องให้ขนาดจริงเท่าเดิม (300 ซม. → 3 ม.) — ผลคำนวณจึงไม่เปลี่ยน
// ช่องว่างคงว่าง · ข้อความที่อ่านเป็นตัวเลขไม่ได้คงไว้ตามที่พิมพ์ (ไม่ลบทิ้ง) · สถานะยืนยัน/ประเภทขนาดคงเดิม
function changeUnit(u) {
  if (state.unit === u) return;
  const conv = (raw) => {
    const r = parseLength(raw, state.unit);
    if (!r.ok || r.value == null) return raw;
    // แปลงจากตัวเลขในหน่วยเดิม (ไม่ผ่าน ซม.) — ปัดให้ตรงในหน่วยใหม่เสมอ เช่น 118.1102 นิ้ว → 300 ซม.
    return String(convertLength(r.value / LENGTH_UNITS[state.unit].toCm, state.unit, u));
  };
  for (const key of ['trialRaw', 'suggestW', 'suggestH']) state[key] = conv(state[key]);
  for (const m of state.measures) {
    if (m.confirm) m.confirm = { ...m.confirm, raw: conv(m.confirm.raw), ...(isBox(m) ? { rawH: conv(m.confirm.rawH ?? '') } : {}) };
    if (m.draft) m.draft = { ...m.draft, raw: conv(m.draft.raw ?? ''), ...(isBox(m) ? { rawH: conv(m.draft.rawH ?? '') } : {}) };
  }
  state.unit = u;
  redraw();
}

function suggestPanel() {
  // มีขนาดที่ยืนยันแล้ว (เส้นใดก็ตาม) → ไม่มีขนาดแนะนำ (กดใช้จะทับตัวเลขของลูกค้า)
  if (!state.img || state.measures.some((m) => m.confirm) || !canSuggestSize({ widthCm: null, heightCm: null })) return null;
  if (!state.suggestOpen) {
    return h('button', { class: 'link-btn sd-suggest-open', 'data-action': 'open-suggest', onclick: () => { state.suggestOpen = true; renderMore(current()); } },
      icon('info'), 'ลูกค้ายังไม่มีขนาด? ใช้ขนาดแนะนำจากพื้นที่ติดตั้ง');
  }
  const result = h('div', { class: 'stack sd-tight', 'data-testid': 'suggest-result' });
  function renderSuggestResult() {
    const a1 = parseLength(state.suggestW, state.unit);
    const a2 = parseLength(state.suggestH, state.unit);
    const s = suggestSignSize({ areaWidthCm: a1.ok ? a1.value : null, areaHeightCm: a2.ok ? a2.value : null, marginPct: Number(state.suggestMargin), imageRatio: state.box ? state.box.width / state.box.height : 0, unit: state.unit });
    if (!s.ok) {
      result.replaceChildren(h('div', { class: 'muted small' }, s.error));
      return;
    }
    const sug = (v) => ({ value: v, source: 'suggested' });
    result.replaceChildren(
      h('div', { class: 'sd-status' }, kindBadge('suggested'), h('b', { 'data-testid': 'suggest-size' }, ` ${L(sug(s.width))} × ${L(sug(s.height))}`)),
      h('ul', { class: 'sd-basis', 'data-testid': 'suggest-basis' }, ...s.basis.map((b) => h('li', {}, b))),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm btn-primary', 'data-action': 'apply-suggest', onclick: () => {
          addOverall();
          const raw = (cm) => formatLength(cm, state.unit).replace(/,/g, '');
          const whole = state.measures.find((m) => m.overall === 'box');
          whole.confirm = { raw: raw(s.width), rawH: raw(s.height), source: 'suggested' };
          if (!state.mainId) state.mainId = whole.id;
          state.suggestOpen = false;
          redraw();
          toast('นำขนาดแนะนำไปใช้กับขนาดรวมทั้งป้ายแล้ว — แสดงเป็น "ขนาดแนะนำ" จนกว่าจะแก้เป็นขนาดของลูกค้า');
        } }, 'ใช้ขนาดนี้')));
  }
  const field = (key, label, ph) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label),
    h('input', { class: 'input', value: state[key], placeholder: ph, inputmode: 'decimal', 'data-field': key, oninput: (e) => { state[key] = e.target.value; renderSuggestResult(); } }));
  renderSuggestResult();
  return h('div', { class: 'sd-suggest', 'data-testid': 'suggest-panel' },
    h('div', { class: 'row sd-suggest-head' }, kindBadge('suggested'), h('b', {}, 'ขนาดแนะนำจากพื้นที่ติดตั้ง'),
      h('button', { class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'ปิดขนาดแนะนำ', 'data-action': 'close-suggest', onclick: () => { state.suggestOpen = false; renderMore(current()); } }, icon('x'))),
    h('div', { class: 'sd-inputs' }, field('suggestW', `พื้นที่กว้าง (${unitLabel()})`, 'เช่น 400'), field('suggestH', `พื้นที่สูง (${unitLabel()})`, 'ไม่บังคับ')),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'เว้นขอบรอบป้าย (% ต่อด้าน)'),
      h('input', { class: 'input input-sm', value: state.suggestMargin, inputmode: 'numeric', 'data-field': 'suggestMargin', oninput: (e) => { state.suggestMargin = e.target.value; renderSuggestResult(); } })),
    result);
}

function renderMore(cur) {
  if (!state.img) return;
  const unitSeg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'หน่วยวัด', 'data-field': 'unit' }, ...Object.entries(LENGTH_UNITS).map(([u, d]) => h('button', {
    class: state.unit === u ? 'on' : '', role: 'radio', 'aria-checked': String(state.unit === u), 'data-unit': u, onclick: () => changeUnit(u),
  }, d.label)));
  const main = measureOf(state.mainId);
  const trial = h('div', { class: 'stack sd-tight' },
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.trialOn, 'data-action': 'toggle-trial', onchange: (e) => { state.trialOn = e.target.checked; redraw(); } }), 'ทดลองปรับขนาด (ไม่แก้ขนาดที่ยืนยัน)'),
    state.trialOn && main
      ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, `ถ้า "${titleOf(main)}" เป็น (${unitLabel()})`),
        h('input', { class: 'input', value: state.trialRaw, placeholder: 'เช่น 240', inputmode: 'decimal', 'data-field': 'trialRaw', oninput: (e) => {
          state.trialRaw = e.target.value;
          const c = current();
          renderOverlays();
          renderMeasure(c);
          renderKnown(c);
          renderPreview(c);
        } }))
      : null);
  view.moreBody.replaceChildren(...[
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'หน่วยวัด'), unitSeg),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'สีเส้นวัด'),
      h('select', { class: 'select', 'data-field': 'lineTheme', value: state.lineTheme, onchange: (e) => { state.lineTheme = e.target.value; redraw(); } },
        h('option', { value: 'dark' }, 'เข้ม (สำหรับป้ายพื้นสว่าง)'),
        h('option', { value: 'light' }, 'อ่อน (สำหรับป้ายพื้นเข้ม)'))),
    trial,
    suggestPanel(),
    state.background?.kind === 'solid'
      ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, `ความไวในการแยกพื้นหลัง: ${state.tolerance}`),
        h('input', { type: 'range', min: '4', max: '80', value: String(state.tolerance), 'data-testid': 'tolerance', onchange: (e) => { state.tolerance = Number(e.target.value); analyze(); redraw(); } }))
      : null,
    h('div', { class: 'row' }, h('button', { class: 'btn btn-sm', disabled: !cur || !cur.check.ok, 'data-action': 'copy-prompt', onclick: copyPrompt }, icon('copy'), 'คัดลอก Prompt สำหรับ ChatGPT')),
  ].filter(Boolean));
}

// ---------------------------------------------------------------- ลากบนภาพ

// ลาก (บนพื้นที่ว่างหรือบนเส้นที่ไม่ได้เลือก) = วัดใหม่ด้วยเครื่องมือที่เลือก · แตะเส้น = เลือก · แตะที่ว่าง = ยกเลิกการเลือก
// เส้นที่เลือกและไม่ล็อก: ลากปลายเส้น = ปรับความยาว · ลากที่จับกลางเส้น = ย้าย (ลากตัวเส้น = วัดเส้นใหม่ ไม่ย้ายโดยไม่ตั้งใจ)
// ใช้ Pointer Events จึงใช้ได้ทั้งเมาส์ ปากกา และนิ้ว (บนโทรศัพท์/แท็บเล็ต)
function bindStage(layer, canvas) {
  let drag = null;
  // เริ่มลากจากขอบรอบภาพได้ (ลากกรอบครอบทั้งป้ายจากมุมภาพ) — ตำแหน่งนอกภาพถูกบีบให้อยู่ที่ขอบภาพ
  const toImage = (e) => {
    const rect = canvas.getBoundingClientRect();
    const k = state.img.width / rect.width;
    const x = Math.max(0, Math.min(state.img.width, (e.clientX - rect.left) * k));
    const y = Math.max(0, Math.min(state.img.height, (e.clientY - rect.top) * k));
    return { x, y, sx: e.clientX, sy: e.clientY };
  };
  layer.addEventListener('pointerdown', (e) => {
    if (!state.img) return;
    const pt = toImage(e);
    const id = e.target.closest('[data-measure]')?.dataset.measure || null;
    const m = measureOf(id);
    const handle = e.target.dataset.h;
    if (m && id === state.selectedId && !isLocked(m) && handle) {
      drag = { mode: handle === 'm' ? 'move' : isBox(m) ? `corner-${handle}` : `end-${handle}`, id, start: pt, orig: geomOf(m) };
    } else {
      drag = { mode: 'pending', start: pt, target: id };
    }
    layer.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  layer.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = toImage(e);
    if (drag.mode === 'pending') {
      if (Math.hypot(pt.sx - drag.start.sx, pt.sy - drag.start.sy) < 6) return;
      drag.mode = 'draw';
    }
    const W = state.img.width;
    const H = state.img.height;
    if (drag.mode === 'draw') {
      const p = { x: Math.max(0, Math.min(W, pt.x)), y: Math.max(0, Math.min(H, pt.y)) };
      drag.line = state.tool === 'box' ? boxFromDrag(drag.start, p) : lineFromDrag(state.tool, drag.start, pt);
      renderOverlays(drag.line);
      return;
    }
    const m = measureOf(drag.id);
    if (isBox(m)) {
      // กรอบ: ย้ายทั้งกรอบ หรือลากมุม (มุมตรงข้ามอยู่กับที่)
      const o = drag.orig;
      const dx = pt.x - drag.start.x;
      const dy = pt.y - drag.start.y;
      if (drag.mode === 'move') {
        m.x = Math.round(Math.max(0, Math.min(W - o.w, o.x + dx)));
        m.y = Math.round(Math.max(0, Math.min(H - o.h, o.y + dy)));
      } else {
        const k = drag.mode.slice(-2);
        const fx = k[1] === 'w' ? o.x + o.w : o.x; // มุมที่อยู่กับที่
        const fy = k[0] === 'n' ? o.y + o.h : o.y;
        const px = Math.max(0, Math.min(W, (k[1] === 'w' ? o.x : o.x + o.w) + dx));
        const py = Math.max(0, Math.min(H, (k[0] === 'n' ? o.y : o.y + o.h) + dy));
        Object.assign(m, { x: Math.round(Math.min(fx, px)), y: Math.round(Math.min(fy, py)), w: Math.max(1, Math.round(Math.abs(px - fx))), h: Math.max(1, Math.round(Math.abs(py - fy))) });
      }
      drag.moved = true;
      renderOverlays();
      return;
    }
    const [du, dv, maxU, maxV] = m.axis === 'x' ? [pt.x - drag.start.x, pt.y - drag.start.y, W, H - 1] : [pt.y - drag.start.y, pt.x - drag.start.x, H, W - 1];
    const o = drag.orig;
    if (drag.mode === 'move') {
      const len = o.b - o.a;
      m.a = Math.round(Math.max(0, Math.min(maxU - len, o.a + du)));
      m.b = m.a + len;
      m.at = Math.round(Math.max(0, Math.min(maxV, o.at + dv)));
    } else {
      const key = drag.mode === 'end-a' ? 'a' : 'b';
      m[key] = Math.round(Math.max(0, Math.min(maxU, o[key] + du)));
    }
    drag.moved = true;
    renderOverlays();
  });
  const end = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.mode === 'draw') {
      const big = d.line && (isBox(d.line) ? d.line.w >= 3 && d.line.h >= 3 : d.line.b - d.line.a >= 3);
      if (big) addMeasure(d.line);
      else renderOverlays();
      return;
    }
    if (d.mode === 'pending') {
      state.selectedId = d.target;
      redraw();
      return;
    }
    if (d.moved) {
      const m = measureOf(d.id);
      if (isBox(m)) {
        redraw();
        return;
      }
      if (m.a > m.b) [m.a, m.b] = [m.b, m.a];
      if (m.b - m.a < 1) m.b = m.a + 1;
      redraw();
    }
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------- ส่งออก

async function pngBytes() {
  if (!lastResult) throw new Error('ยังสร้างภาพไม่ได้');
  const blob = await canvasToPng(lastResult.canvas);
  return new Uint8Array(await blob.arrayBuffer());
}

const fileNameNow = (cur) => exportFileName(cur.sign, { trial: Boolean(cur.trial), unit: state.unit });

async function savePng() {
  const cur = current();
  if (!cur?.check.ok) return;
  try {
    const r = await api().file.savePng({ defaultName: fileNameNow(cur), data: await pngBytes(), sourcePath: state.sourcePath });
    if (!r.canceled) toast('ดาวน์โหลดภาพแสดงขนาดแล้ว');
  } catch (err) {
    toastError(err, 'บันทึกภาพไม่สำเร็จ');
  }
}

function promptText() {
  const cur = current();
  return buildDimensionPrompt({
    fileName: state.fileName || 'ภาพป้าย.png',
    imageSize: { width: state.img.width, height: state.img.height },
    box: state.box,
    background: state.background,
    removeBackground: state.removeBackground === true,
    dims: cur.sign,
    unit: state.unit,
  });
}

async function copyPrompt() {
  try {
    await api().clipboard.writeText(promptText());
    toast('คัดลอก Prompt แล้ว — แนบไฟล์ภาพเดิมใน ChatGPT ด้วย');
  } catch (err) {
    toastError(err, 'คัดลอกไม่สำเร็จ');
  }
}

// ---------------------------------------------------------------- หน้าจอ

export function render(container) {
  const fileInput = h('input', { type: 'file', accept: ACCEPT, class: 'hidden', 'data-testid': 'sign-file-input' });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
    fileInput.value = '';
  });
  const dropzone = h('div', { class: 'dropzone', role: 'button', tabindex: '0', 'data-action': 'choose-sign-image', onclick: () => fileInput.click(), onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && fileInput.click() },
    icon('image'),
    h('div', {}, h('div', { class: 'dz-title' }, 'เลือกภาพป้าย (แตะหรือลากไฟล์มาวาง)'), h('div', { class: 'dz-hint' }, 'PNG, JPG หรือ WEBP · ไฟล์ต้นฉบับไม่ถูกแก้ไข')));
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('over');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  const v = {
    dropzone,
    steps: h('div', { class: 'sd-steps', 'data-testid': 'steps' }),
    fileInfo: h('div', { class: 'sd-file hidden' }),
    bgBody: h('div', { class: 'stack', 'data-testid': 'bg-card' }),
    tools: h('div', { class: 'row sd-tools', 'data-testid': 'tools' }),
    stage: h('div', { class: 'sd-stage sd-checker', 'data-testid': 'stage' }),
    stageCanvas: h('canvas', {}),
    overlayLayer: h('div', { class: 'sd-layer', 'data-testid': 'overlay-layer' }),
    boxInfo: h('span', { class: 'muted small', 'data-testid': 'box-info' }),
    panel: h('div', { class: 'qs-section sd-panel hidden', 'data-testid': 'part-panel' }),
    knownBody: h('div', { class: 'stack' }),
    measureBody: h('div', { class: 'stack' }),
    previewWrap: h('div', { class: 'sd-result', 'data-testid': 'result' }),
    messages: h('div', { class: 'stack sd-msgs', 'data-testid': 'messages' }),
    jobStatus: h('span', { class: 'muted small', 'data-testid': 'job-status' }),
    saveJobBtn: h('button', { class: 'btn', 'data-action': 'save-dimension-job', onclick: saveJob }),
    moreBody: h('div', { class: 'stack' }),
    jobsBody: h('div', { class: 'stack' }),
    jobsCount: h('span', { class: 'muted' }),
    jobsToggle: h('button', { class: 'link-btn', 'data-action': 'toggle-jobs', onclick: () => { jobsView.open = !jobsView.open; renderJobs(); } }),
  };
  v.saveBtn = h('button', { class: 'btn btn-primary', 'data-action': 'save-png', onclick: savePng }, icon('download'), 'ดาวน์โหลดภาพ (PNG)');
  v.arrangeBtn = h('button', { class: 'btn btn-sm', 'data-action': 'arrange-dims', onclick: arrangeDims }, icon('layout'), 'จัดเส้นวัดให้อ่านง่าย');
  v.previewHint = h('div', { class: 'muted small', 'data-testid': 'preview-hint' });
  v.boundsToggle = h('input', { type: 'checkbox', checked: state.bounds, 'data-action': 'toggle-bounds', onchange: (e) => { state.bounds = e.target.checked; redraw(); } });
  v.stage.append(v.stageCanvas, v.overlayLayer);
  bindStage(v.stage, v.stageCanvas);
  v.stageCard = h('div', { class: 'stack', 'data-order': '2' },
    h('div', { class: 'sec-head' }, h('div', { class: 'sec-no' }, '2'), h('div', {}, h('div', { class: 'sec-title' }, 'ลากกรอบหรือเส้นบนภาพ'))),
    v.tools,
    v.stage,
    h('div', { class: 'sd-hint' }, 'ลากกรอบครอบทั้งป้าย หรือเลือกเส้นเพื่อวัดรายละเอียด · แตะกรอบ/เส้นเพื่อแก้ (ลากมุมหรือปลายเส้นเพื่อปรับขนาด ลากจุดกลมตรงกลางเพื่อย้าย)'),
    v.boxInfo,
    h('datalist', { id: 'sd-names' }, ...NAME_SUGGESTIONS.map((n) => h('option', { value: n }))));
  v.previewCard = h('div', { class: 'stack', 'data-testid': 'result-card' },
    h('div', { class: 'row sd-preview-head' }, h('div', { class: 'field-label' }, 'ภาพที่จะดาวน์โหลด (ลายตาราง = ส่วนโปร่งใส)'), v.arrangeBtn),
    h('label', { class: 'check' }, v.boundsToggle, 'แสดงเส้นปะขอบเขตการวัด (บอกว่าวัดจากตรงไหนถึงตรงไหน)'),
    v.previewWrap, v.previewHint);
  v.panel.dataset.order = '3';
  v.rightCol = h('div', { class: 'sd-col' },
    v.panel,
    section(3, 'ขนาดจริงที่รู้', 'ขนาดจริงที่ยืนยันแล้วถูกล็อกไว้', v.knownBody, { 'data-testid': 'known-card', 'data-order': '4' }),
    section(4, 'ขนาดในภาพ และดาวน์โหลด', 'ขนาดที่คำนวณจากภาพมี ≈ นำหน้า', h('div', { class: 'stack' },
      v.measureBody, v.previewCard, v.messages,
      h('div', { class: 'row' }, v.saveBtn),
      h('div', { class: 'sd-save' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'ชื่องาน (ไม่บังคับ)'),
          h('input', { class: 'input', value: state.jobName, placeholder: 'เช่น ป้ายหน้าร้าน', 'data-field': 'jobName', oninput: (e) => { state.jobName = e.target.value; renderSaveStatus(); } })),
        h('div', { class: 'row' }, v.saveJobBtn, v.jobStatus)),
      h('details', { class: 'sd-fold sd-more', 'data-testid': 'more-options' }, h('summary', {}, icon('sliders'), 'ตัวเลือกเพิ่มเติม'), v.moreBody)),
    { 'data-testid': 'measure-card', 'data-order': '5' }));
  view = v;

  container.replaceChildren(
    h('div', { class: 'sd-page', 'data-testid': 'sign-dimensions-page' },
      h('div', { class: 'qs-hero' }, h('div', {}, h('h1', { class: 'qs-title' }, 'ภาพแสดงขนาดป้าย'),
        h('div', { class: 'qs-sub' }, 'ลากกรอบวัดทั้งป้าย ลากเส้นวัดรายละเอียด กรอกขนาดจริงที่รู้ — โปรแกรมจัดเส้นบอกขนาดให้เอง'))),
      v.steps,
      h('div', { class: 'sd-legend', 'data-testid': 'kind-legend' },
        h('span', { class: 'sd-legend-item' }, kindBadge('user'), h('span', { class: 'muted small' }, 'ขนาดจริงที่คุณกรอก (ล็อกไว้)')),
        h('span', { class: 'sd-legend-item' }, kindBadge('estimated'), h('span', { class: 'muted small' }, 'โปรแกรมคำนวณให้ (≈)'))),
      h('section', { class: 'qs-section sd-jobs-card', 'data-testid': 'jobs-card' },
        h('div', { class: 'row sd-jobs-head' }, h('div', { class: 'sec-title' }, icon('folder'), 'งานที่บันทึกไว้ ', v.jobsCount),
          h('div', { class: 'row' }, v.jobsToggle, h('button', { class: 'btn btn-sm', 'data-action': 'new-dimension-job', onclick: newJob }, icon('plus'), 'เริ่มงานใหม่'))),
        v.jobsBody),
      h('div', { class: 'sd-grid' },
        h('div', { class: 'sd-col' },
          section(1, 'อัปโหลดภาพ', null, h('div', { class: 'stack' }, dropzone, fileInput, v.fileInfo, v.bgBody), { 'data-step': '1', 'data-order': '1' }),
          v.stageCard),
        v.rightCol)),
  );
  redraw();
  loadJobs();
  // canvas วาดตัวเลขด้วยฟอนต์ของโปรแกรม — รอฟอนต์แล้ววาดใหม่ครั้งเดียว
  loadFonts().then(() => redraw());
  return () => {
    view = null;
    lastResult = null;
  };
}

// ---------------------------------------------------------------- สำหรับสคริปต์ทดสอบภาพตัวอย่าง (prototypes/sign-dimensions)

export function debugHandle() {
  const b64 = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  return {
    loads: () => loadCount,
    set(patch) {
      if (patch.box) {
        state.box = clampBox(patch.box, state.img.width, state.img.height);
        state.manualBox = true;
      }
      if (patch.measures) {
        state.measures = patch.measures.map((m, i) => ({ id: m.id || `d${i + 1}`, type: 'size', name: '', confirm: null, draft: null, drawn: null, side: 'auto', hidden: false, overall: null, ...m }));
        state.nextMeasure = state.measures.length + 1;
      }
      for (const k of ['unit', 'mainId', 'trialOn', 'trialRaw', 'selectedId', 'removeBackground', 'lineTheme', 'snap', 'bounds']) if (k in patch) state[k] = patch[k];
      // สคริปต์รุ่นก่อน: กรอกขนาดป้าย = เส้นขนาดรวมทั้งป้ายที่ยืนยัน
      if ('widthRaw' in patch || 'heightRaw' in patch) {
        addOverall();
        const whole = state.measures.find((m) => m.overall === 'box');
        const w = String(patch.widthRaw || '').trim();
        const hh = String(patch.heightRaw || '').trim();
        whole.confirm = w || hh ? { raw: w, rawH: hh, source: patch.sizeSource || 'customer' } : null;
        if (!state.mainId) state.mainId = state.measures.find((m) => m.confirm)?.id || '';
      }
      if ('tolerance' in patch) {
        state.tolerance = patch.tolerance;
        analyze();
      }
      redraw();
      return this.state();
    },
    state() {
      const cur = current();
      return {
        background: state.background, autoBox: state.autoBox, box: state.box, removeBackground: state.removeBackground, dims: cur?.sign, shown: cur?.sign, check: cur?.check,
        unit: state.unit, mainId: state.mainId, warnings: cur?.warnings || [], jobId: state.jobId, dirty: isDirty(),
        bgWarnings: state.img ? backgroundWarnings(state.img.rgba, state.img.width, state.img.height, state.background, state.mask, state.box, { tolerance: state.tolerance }) : [],
        measures: state.measures.map((m) => ({ ...m, value: cur && !cur.missing ? cur.value(m) : null })),
        layout: lastResult?.layout, cropBox: lastResult?.cropBox, notes: lastResult?.notes || [], bounds: lastResult?.bounds || [],
      };
    },
    png: async () => b64(await pngBytes()),
    // พิกเซลต้นฉบับในกรอบ + หน้ากากพื้นหลัง — ให้สคริปต์ทดสอบเทียบว่าภาพผลลัพธ์ไม่แตะพิกเซลของป้าย
    original() {
      const bx = state.box;
      const crop = cropPixels(state.img.rgba, state.img.width, bx, null, false);
      const mask = new Uint8Array(bx.width * bx.height);
      for (let y = 0; y < bx.height; y += 1) for (let x = 0; x < bx.width; x += 1) mask[y * bx.width + x] = state.mask[(bx.y + y) * state.img.width + bx.x + x];
      return { rgba: b64(new Uint8Array(crop.buffer)), mask: b64(mask) };
    },
    prompt: () => promptText(),
    fileName: () => fileNameNow(current()),
  };
}
