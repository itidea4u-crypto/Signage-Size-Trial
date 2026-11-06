// แบบจำลองข้อมูลโครงการ: สร้างโครงการใหม่ และตรวจ/ทำความสะอาดข้อมูลก่อนบันทึก
// ใช้ทั้งฝั่ง main (ก่อนเขียนไฟล์) และฝั่งหน้าจอ (สร้างโครงการเปล่า)

import { LIMITS, PLACEMENTS, PROJECT_STATUSES, SCHEMA_VERSION, SIGN_TYPES, UNITS } from './constants.js';
import { DEFAULT_PPI, normalizePpi } from './print-file.js';
import { SIZE_VALUE_MAX } from './sign-size.js';

const ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;

export function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export function newId() {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  // เบราว์เซอร์ที่ไม่ได้เปิดผ่าน HTTPS (เช่น เวอร์ชันมือถือที่ทดลองผ่าน Wi-Fi) ไม่มี randomUUID
  // จึงสร้าง UUID v4 จาก getRandomValues (ใช้ได้ทุกที่) แทน
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function str(value, max = LIMITS.shortText) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, max);
}

function num(value, { min = 0, max = 1e6, fallback = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function oneOf(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function strList(value, maxItems = LIMITS.listItems, maxLen = LIMITS.shortText) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim() !== '')
    .slice(0, maxItems)
    .map((v) => v.slice(0, maxLen));
}

function idList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const v of value) {
    if (typeof v === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.slice(0, LIMITS.listItems);
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// ค่าว่าง ('' หรือ 0) = ยังไม่ระบุ — โครงการใหม่ไม่เดาประเภทป้าย การติดตั้ง ขนาด หรือระยะมองเห็นแทนผู้ใช้
export function emptyBrief(defaults = {}) {
  return {
    signType: defaults.signType ?? '',
    material: '',
    width: defaults.width ?? 0,
    height: defaults.height ?? 0,
    unit: defaults.unit || 'cm',
    targetPpi: DEFAULT_PPI,
    placement: '',
    viewingDistanceM: 0,
    headline: '',
    subheadline: '',
    bodyText: '',
    contact: '',
    objective: '',
    audience: '',
    styles: [],
    colors: [],
    mustHave: '',
    avoid: '',
    notes: '',
    references: [],
    shopName: null,
    shopNameIgnored: [],
  };
}

// ภาพอ้างอิง/โลโก้ที่แนบในหน้าเริ่มด่วน (เก็บเป็น data URL ในไฟล์โครงการ)
export const REFERENCE_KINDS = [
  { id: 'logo', label: 'โลโก้' },
  { id: 'reference', label: 'ภาพอ้างอิง' },
];

function normalizeReferences(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && typeof r === 'object' && typeof r.src === 'string' && r.src.startsWith('data:image/') && r.src.length <= LIMITS.imageDataUrlBytes)
    .slice(0, LIMITS.references)
    .map((r) => ({
      id: typeof r.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(r.id) ? r.id : newId(),
      kind: oneOf(r.kind, REFERENCE_KINDS.map((k) => k.id), 'reference'),
      name: str(r.name, 120),
      note: str(r.note, 500),
      src: r.src,
      // true = เก็บไฟล์ต้นฉบับไว้ตรงตัว (ไม่ถูกย่อ) — ภาพที่แนบก่อนเวอร์ชันนี้ถูกย่อไว้แล้ว
      original: r.original === true,
    }));
}

export function normalizeBrief(input = {}) {
  const b = typeof input === 'object' && input ? input : {};
  const base = emptyBrief();
  return {
    signType: oneOf(b.signType, ['', ...SIGN_TYPES.map((t) => t.id)], base.signType),
    material: str(b.material),
    width: num(b.width, { min: 0, max: SIZE_VALUE_MAX, fallback: base.width }),
    height: num(b.height, { min: 0, max: SIZE_VALUE_MAX, fallback: base.height }),
    unit: oneOf(b.unit, Object.keys(UNITS), base.unit),
    // ความละเอียดเป้าหมายของไฟล์งานพิมพ์ (PPI) — โครงการเดิมที่ไม่มีค่านี้ใช้ค่าเริ่มต้น 100
    targetPpi: normalizePpi(b.targetPpi),
    placement: oneOf(b.placement, ['', ...PLACEMENTS.map((p) => p.id)], base.placement),
    viewingDistanceM: num(b.viewingDistanceM, { min: 0, max: 10000, fallback: base.viewingDistanceM }),
    headline: str(b.headline, LIMITS.longText),
    subheadline: str(b.subheadline, LIMITS.longText),
    bodyText: str(b.bodyText, LIMITS.longText),
    contact: str(b.contact, LIMITS.longText),
    objective: str(b.objective, LIMITS.longText),
    audience: str(b.audience, LIMITS.longText),
    styles: strList(b.styles),
    colors: Array.isArray(b.colors) ? b.colors.filter((c) => HEX_COLOR.test(c)).slice(0, 12) : [],
    mustHave: str(b.mustHave, LIMITS.longText),
    avoid: str(b.avoid, LIMITS.longText),
    notes: str(b.notes, LIMITS.longText),
    references: normalizeReferences(b.references),
    // ชื่อร้านที่ผู้ใช้ยืนยันจากรายละเอียดงาน (detected = ข้อความที่ตรวจพบตอนยืนยัน, null = ยืนยันว่าถูกต้องเสมอ)
    shopName: b.shopName && typeof b.shopName === 'object' && typeof b.shopName.value === 'string' && b.shopName.value.trim()
      ? { detected: typeof b.shopName.detected === 'string' ? str(b.shopName.detected) : null, value: str(b.shopName.value) }
      : null,
    // คำที่ผู้ใช้บอกว่า "ไม่ใช่ชื่อร้าน"
    shopNameIgnored: strList(b.shopNameIgnored, 20),
  };
}

const ELEMENT_TYPES = ['text', 'image', 'rect'];

function normalizeElement(el) {
  if (!el || typeof el !== 'object' || !ELEMENT_TYPES.includes(el.type)) return null;
  const p = el.props && typeof el.props === 'object' ? el.props : {};
  const out = {
    id: typeof el.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(el.id) ? el.id : newId(),
    type: el.type,
    name: str(el.name, 80),
    // พิกัดเป็นสัดส่วน 0–1 ของพื้นที่ป้าย เพื่อให้ใช้ได้ทุกขนาด
    x: num(el.x, { min: -1, max: 2 }),
    y: num(el.y, { min: -1, max: 2 }),
    w: num(el.w, { min: 0.005, max: 3, fallback: 0.3 }),
    h: num(el.h, { min: 0.005, max: 3, fallback: 0.1 }),
    locked: el.locked === true,
    props: {},
  };
  if (el.type === 'text') {
    out.props = {
      text: str(p.text, LIMITS.longText),
      fontSize: num(p.fontSize, { min: 0.005, max: 1, fallback: 0.06 }),
      color: HEX_COLOR.test(p.color) ? p.color : '#1f2937',
      weight: oneOf(Number(p.weight), [400, 500, 600, 700], 600),
      align: oneOf(p.align, ['left', 'center', 'right'], 'center'),
      role: oneOf(p.role, ['headline', 'subheadline', 'body', 'contact', 'other'], 'other'),
    };
  } else if (el.type === 'image') {
    const src = typeof p.src === 'string' && p.src.startsWith('data:image/') && p.src.length <= LIMITS.imageDataUrlBytes ? p.src : '';
    out.props = { src, fit: oneOf(p.fit, ['contain', 'cover'], 'contain'), description: str(p.description, 500) };
  } else {
    out.props = {
      fill: HEX_COLOR.test(p.fill) ? p.fill : '#6366f1',
      radius: num(p.radius, { min: 0, max: 0.5 }),
      opacity: num(p.opacity, { min: 0, max: 1, fallback: 1 }),
    };
  }
  return out;
}

export function normalizeLayout(input = {}) {
  const l = typeof input === 'object' && input ? input : {};
  const elements = Array.isArray(l.elements)
    ? l.elements.slice(0, LIMITS.layoutElements).map(normalizeElement).filter(Boolean)
    : [];
  return { background: HEX_COLOR.test(l.background) ? l.background : '#ffffff', elements };
}

export function createProject(defaults = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name: '',
    client: '',
    status: 'draft',
    tags: [],
    createdAt: now,
    updatedAt: now,
    brief: emptyBrief(defaults),
    // true = ระบบเลือก Workflow/Skill ให้ตามข้อมูลที่กรอก, false = ผู้ใช้เลือกเอง (workflowIds/skillIds)
    autoDesign: defaults.autoDesign !== false,
    // image = ให้ ChatGPT สร้างภาพป้ายทันที (ค่าเริ่มต้น), plan = วิเคราะห์และเสนอแนวคิดก่อน (แบบเดิม)
    promptMode: defaults.promptMode === 'plan' ? 'plan' : 'image',
    // with-text = ใส่ข้อความภาษาไทยในภาพ (ค่าเริ่มต้น), background = ภาพพื้นหลังไม่มีข้อความ
    imageTextMode: 'with-text',
    // วิธีใช้ภาพอ้างอิง: inspire = ออกแบบใหม่จากภาพอ้างอิง (ค่าเริ่มต้น), similar = ออกแบบใกล้เคียงภาพอ้างอิง
    referenceMode: 'inspire',
    workflowIds: idList(defaults.workflowIds),
    skillIds: idList(defaults.skillIds),
    layout: normalizeLayout(),
    lastPrompt: '',
    promptGeneratedAt: null,
  };
}

function isoOr(value, fallback) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

// ตรวจและทำความสะอาดข้อมูลโครงการทั้งก้อน — คืนค่าใหม่เสมอ ไม่แก้ไขของเดิม
export function normalizeProject(input) {
  if (!input || typeof input !== 'object') throw new Error('ข้อมูลโครงการไม่ถูกต้อง');
  if (!isValidId(input.id)) throw new Error('รหัสโครงการไม่ถูกต้อง');
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id,
    name: str(input.name).trim(),
    client: str(input.client).trim(),
    status: oneOf(input.status, PROJECT_STATUSES.map((s) => s.id), 'draft'),
    tags: strList(input.tags, 20, 40),
    createdAt: isoOr(input.createdAt, now),
    updatedAt: isoOr(input.updatedAt, now),
    brief: normalizeBrief(input.brief),
    autoDesign: input.autoDesign === true,
    promptMode: oneOf(input.promptMode, ['image', 'plan'], 'image'),
    imageTextMode: oneOf(input.imageTextMode, ['with-text', 'background'], 'with-text'),
    referenceMode: oneOf(input.referenceMode, ['inspire', 'similar'], 'inspire'),
    workflowIds: idList(input.workflowIds),
    skillIds: idList(input.skillIds),
    layout: normalizeLayout(input.layout),
    lastPrompt: str(input.lastPrompt, 100000),
    promptGeneratedAt: input.promptGeneratedAt ? isoOr(input.promptGeneratedAt, null) : null,
  };
}

// ข้อมูลย่อสำหรับแสดงในคลังโครงการ (ไม่รวมรูปภาพขนาดใหญ่)
export function summarizeProject(p) {
  const b = p.brief || {};
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    status: p.status,
    tags: p.tags,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    signType: b.signType,
    width: b.width,
    height: b.height,
    unit: b.unit,
    headline: b.headline,
    hasPrompt: Boolean(p.lastPrompt),
    elementCount: p.layout?.elements?.length || 0,
    referenceCount: b.references?.length || 0,
    searchText: [p.name, p.client, b.headline, b.subheadline, b.bodyText, b.contact, b.material, b.objective, ...(p.tags || [])]
      .join(' ')
      .toLowerCase(),
  };
}

export function projectDisplayName(p) {
  return p.name || p.brief?.headline || 'โครงการไม่มีชื่อ';
}
