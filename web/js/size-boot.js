// ติดตั้ง window.ify ฉบับย่อของหน้า "ภาพแสดงขนาดป้าย" (size-api.js) ก่อนโหลดหน้า
// ไม่โหลดระบบสร้างคำสั่ง/Workflow/Skill — หน้านี้จึงนำขึ้นเว็บทดลองแยกได้โดยไม่เปิดเผยความรู้ภายในบริษัท
// ที่เก็บข้อมูลเดียวกับหน้าแรก (IndexedDB "ideaforyou-mobile") งานที่บันทึกจึงอยู่ในไฟล์สำรองของหน้าแรกด้วย

import './polyfills.js';
import { idbBackend } from './idb.js';
import { createSizeApi } from './size-api.js';
import { WEB_VERSION } from './version.js';

window.ify = createSizeApi(idbBackend(), { version: WEB_VERSION });
