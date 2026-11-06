// ค่าคงที่ที่ใช้ร่วมกันระหว่าง main process และหน้าจอโปรแกรม (renderer)

export const APP_NAME = 'IdeaForYou AI Design Studio';
export const COMPANY_NAME = 'บริษัท ไอเดีย ฟอร์ยู 1979 จำกัด';

// เวอร์ชันโครงสร้างข้อมูล — เพิ่มเลขเมื่อเปลี่ยนรูปแบบไฟล์ แล้วเขียน migration ใน src/main/storage/migrations.js
// v2 (0.2.0): เพิ่ม brief.references (ภาพอ้างอิง/โลโก้), autoDesign (ให้ระบบเลือก Workflow/Skill อัตโนมัติ),
//             promptMode/imageTextMode (รูปแบบคำสั่ง) และ referenceMode (วิธีใช้ภาพอ้างอิง) — ยังไม่ออกเวอร์ชัน จึงรวมใน v2
export const SCHEMA_VERSION = 2;

export const UNITS = {
  mm: { label: 'มม.', toCm: 0.1 },
  cm: { label: 'ซม.', toCm: 1 },
  m: { label: 'ม.', toCm: 100 },
  in: { label: 'นิ้ว', toCm: 2.54 },
};

export const SIGN_TYPES = [
  { id: 'vinyl', label: 'ป้ายไวนิล' },
  { id: 'storefront', label: 'ป้ายหน้าร้าน' },
  { id: 'lightbox', label: 'ป้ายกล่องไฟ' },
  { id: 'letters', label: 'ป้ายตัวอักษร (ตัวนูน/ตัวไฟ)' },
  { id: 'aboard', label: 'ป้ายตั้งพื้น (A-Board)' },
  { id: 'rollup', label: 'ป้ายโรลอัพ / X-Stand' },
  { id: 'poster', label: 'โปสเตอร์ / สติกเกอร์' },
  { id: 'billboard', label: 'ป้ายบิลบอร์ด' },
  { id: 'wayfinding', label: 'ป้ายบอกทาง / ป้ายสัญลักษณ์' },
  { id: 'other', label: 'อื่น ๆ' },
];

export const SIZE_PRESETS = [
  { id: 'vinyl-120x240', label: 'ไวนิล 120 × 240 ซม.', width: 120, height: 240, unit: 'cm', signType: 'vinyl' },
  { id: 'vinyl-100x300', label: 'ไวนิล 300 × 100 ซม.', width: 300, height: 100, unit: 'cm', signType: 'vinyl' },
  { id: 'vinyl-200x400', label: 'ไวนิล 400 × 200 ซม.', width: 400, height: 200, unit: 'cm', signType: 'vinyl' },
  { id: 'storefront-400x80', label: 'หน้าร้าน 400 × 80 ซม.', width: 400, height: 80, unit: 'cm', signType: 'storefront' },
  { id: 'aboard-60x90', label: 'A-Board 60 × 90 ซม.', width: 60, height: 90, unit: 'cm', signType: 'aboard' },
  { id: 'rollup-80x200', label: 'โรลอัพ 80 × 200 ซม.', width: 80, height: 200, unit: 'cm', signType: 'rollup' },
  { id: 'poster-a3', label: 'โปสเตอร์ A3 (29.7 × 42 ซม.)', width: 29.7, height: 42, unit: 'cm', signType: 'poster' },
  { id: 'poster-a1', label: 'โปสเตอร์ A1 (59.4 × 84.1 ซม.)', width: 59.4, height: 84.1, unit: 'cm', signType: 'poster' },
  { id: 'billboard-1200x600', label: 'บิลบอร์ด 12 × 6 ม.', width: 12, height: 6, unit: 'm', signType: 'billboard' },
];

export const STYLE_OPTIONS = [
  'ทันสมัย', 'มินิมอล', 'หรูหรา', 'สนุกสนาน', 'เป็นทางการ', 'วินเทจ',
  'ธรรมชาติ', 'เทคโนโลยี', 'ไทยร่วมสมัย', 'สดใส', 'อบอุ่น', 'พรีเมียม',
];

export const PROJECT_STATUSES = [
  { id: 'draft', label: 'ร่าง' },
  { id: 'in_progress', label: 'กำลังทำ' },
  { id: 'review', label: 'รอลูกค้าตรวจ' },
  { id: 'done', label: 'เสร็จแล้ว' },
];

export const PLACEMENTS = [
  { id: 'outdoor', label: 'กลางแจ้ง' },
  { id: 'indoor', label: 'ในอาคาร' },
];

// ขีดจำกัดขนาดข้อมูล ป้องกันไฟล์ใหญ่ผิดปกติ
export const LIMITS = {
  shortText: 200,
  longText: 5000,
  listItems: 50,
  layoutElements: 200,
  imageDataUrlBytes: 8 * 1024 * 1024,
  references: 6,
};
