// เมนู "ภาพแสดงขนาดป้าย" ของเว็บแอป — ใช้หน้าเดียวกับโปรแกรม Windows (src/renderer/js/pages/sign-dimensions.js)
// ตรรกะคำนวณ (src/shared/sign-scale.js, sign-dimensions.js) ชุดเดียวกัน · งานที่บันทึกเก็บใน IndexedDB ของเครื่องนี้
// ลำดับ import สำคัญ: size-boot.js ต้องมาก่อน (ติดตั้ง window.ify ฉบับย่อ)

import './size-boot.js';
import { render } from '../../src/renderer/js/pages/sign-dimensions.js';

// ธีมตามเครื่อง (เหมือนหน้าแรกของเว็บแอป)
const dark = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => {
  document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light';
};
applyTheme();
dark.addEventListener?.('change', applyTheme);

render(document.getElementById('size-root'));
document.body.dataset.ready = 'true';

if ('serviceWorker' in navigator && globalThis.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
