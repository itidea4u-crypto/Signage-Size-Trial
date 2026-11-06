// window.ify ฉบับย่อสำหรับเมนู "ภาพแสดงขนาดป้าย" ของเว็บแอป — มีเฉพาะคำสั่งที่หน้านี้ใช้
// (งานภาพแสดงขนาด บันทึก PNG คัดลอกข้อความ) จึงไม่โหลดระบบสร้างคำสั่ง/Workflow/Skill ของบริษัท
// web-api.js (หน้าแรกของเว็บแอป) ใช้ส่วนเดียวกันนี้ — รูปแบบเดียวกับ preload ของโปรแกรมคอมพิวเตอร์
// ข้อมูลทั้งหมดอยู่ในเครื่อง (backend) — ไม่มีการส่งข้อมูลขึ้นเซิร์ฟเวอร์

import { APP_NAME } from '../../src/shared/constants.js';
import { normalizeDimensionJob, summarizeDimensionJob } from '../../src/shared/dimension-job.js';
import { isValidId } from '../../src/shared/project-model.js';

// คัดลอกแบบเดิม (สำหรับหน้าที่ไม่ได้เปิดผ่าน HTTPS เช่น ทดลองผ่าน Wi-Fi ในออฟฟิศ)
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  Object.assign(ta.style, { position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '16px' });
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  if (!ok) throw new Error('เบราว์เซอร์ไม่อนุญาตให้คัดลอก — กด "ดูคำสั่งทั้งหมด" แล้วกดค้างที่ข้อความเพื่อคัดลอก');
}

/** คัดลอกข้อความ: ใช้ clipboard API เมื่อเป็น HTTPS ไม่เช่นนั้นใช้วิธีเดิม */
export async function copyText(text) {
  const value = String(text ?? '');
  if (navigator.clipboard && globalThis.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // บางเบราว์เซอร์ปฏิเสธ — ลองวิธีเดิม
    }
  }
  legacyCopy(value);
  return true;
}

/**
 * ส่งไฟล์ให้ผู้ใช้: มือถือ/แท็บเล็ตใช้เมนูแชร์ (บันทึกลงรูปภาพ ไฟล์ หรือส่งต่อ) ถ้ารองรับ ไม่เช่นนั้นดาวน์โหลดไฟล์
 * @returns {Promise<{ canceled: boolean, path?: string }>}
 */
export async function saveBlob(blob, name) {
  const file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null;
  const touch = globalThis.matchMedia?.('(pointer: coarse)').matches;
  if (touch && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return { canceled: false, path: name };
    } catch (err) {
      if (err?.name === 'AbortError') return { canceled: true };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  Object.assign(a, { href: url, download: name });
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { canceled: false, path: name };
}

/** บันทึกภาพ PNG (เบราว์เซอร์ไม่รู้ตำแหน่งไฟล์ในเครื่อง และบันทึกทับไฟล์ต้นฉบับไม่ได้อยู่แล้ว) */
export const webFile = {
  pathOf: () => '',
  async savePng({ defaultName, data }) {
    const name = String(defaultName || 'ภาพแสดงขนาด.png');
    const blob = new Blob([data], { type: 'image/png' });
    return saveBlob(blob, name);
  },
};

/** งาน "ภาพแสดงขนาดป้าย" — รูปแบบเดียวกับ DimensionJobStore ของโปรแกรมคอมพิวเตอร์ (src/main/storage/dimension-job-store.js) */
export function dimensionJobsApi(backend) {
  return {
    async list() {
      const items = [];
      const errors = [];
      for (const raw of await backend.allDimensionJobs()) {
        try {
          items.push(summarizeDimensionJob(normalizeDimensionJob(raw)));
        } catch (err) {
          errors.push({ file: String(raw?.id || ''), message: err.message });
        }
      }
      items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return { items, errors };
    },
    async get(id) {
      if (!isValidId(id)) throw new Error('รหัสงานไม่ถูกต้อง');
      const raw = await backend.getDimensionJob(id);
      return raw ? normalizeDimensionJob(raw) : null;
    },
    // เวลาแก้ไขล่าสุดเป็นเวลาที่บันทึก และคงวันที่สร้างเดิม
    async save(input) {
      const job = normalizeDimensionJob({ ...input, updatedAt: new Date().toISOString() });
      const existing = await backend.getDimensionJob(job.id);
      if (existing?.createdAt) job.createdAt = existing.createdAt;
      await backend.putDimensionJob(job);
      return summarizeDimensionJob(job);
    },
    async delete(id) {
      if (!isValidId(id)) throw new Error('รหัสงานไม่ถูกต้อง');
      await backend.deleteDimensionJob(id);
      return true;
    },
  };
}

/**
 * window.ify ฉบับย่อของหน้า "ภาพแสดงขนาดป้าย"
 * @param {{ allDimensionJobs: Function, getDimensionJob: Function, putDimensionJob: Function, deleteDimensionJob: Function }} backend
 * @param {{ version?: string }} [opts]
 */
export function createSizeApi(backend, { version = '' } = {}) {
  return {
    platform: 'web',
    app: {
      info: async () => ({ name: APP_NAME, version, isPackaged: false, platform: 'web' }),
      setDirty: async () => {},
      setDraftCurrent: async () => {},
    },
    dimensionJobs: dimensionJobsApi(backend),
    file: webFile,
    clipboard: { writeText: copyText },
  };
}
