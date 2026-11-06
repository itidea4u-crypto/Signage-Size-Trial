// เบราว์เซอร์รุ่นเก่า (Safari ก่อน iOS 15.4) ยังไม่มีฟังก์ชันเหล่านี้ — ข้อมูลงานเป็น JSON ล้วน จึงคัดลอกผ่าน JSON ได้
// ใช้ร่วมกันระหว่างหน้าแรก (boot.js) และหน้าภาพแสดงขนาดป้าย (size-boot.js)
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
}
if (typeof Object.hasOwn !== 'function') {
  Object.hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
}
