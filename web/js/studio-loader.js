// ตัวเปิดเว็บ IdeaForYou AI Design Studio: รับรหัสผ่าน → ถอดรหัสโมดูลของแอป (web/studio.enc) ในเครื่อง → เริ่มแอป
//
// - ไฟล์ที่เผยแพร่มีเฉพาะข้อมูลที่เข้ารหัสแล้ว (ดู web/js/vault.js) ไม่มีรหัสผ่านหรือกุญแจถอดรหัส
// - "จำบนเครื่องนี้" เก็บกุญแจห่อแบบดึงออกไม่ได้ (CryptoKey non-extractable) ใน IndexedDB — ไม่เก็บรหัสผ่าน
//   กุญแจนี้ใช้ได้กับเว็บรุ่นถัดไปตราบใดที่รหัสผ่านไม่เปลี่ยน · กด "ล็อก" เพื่อลบ
// - โมดูลที่ถอดรหัสแล้วโหลดผ่าน blob: URL (ไม่เขียนลงไฟล์) โดยแทนที่ "@ify:<ที่อยู่ไฟล์>" ใน import
//   ด้วย blob ของโมดูลที่เข้ารหัส หรือที่อยู่จริงของไฟล์สาธารณะ (เช่น src/shared/constants.js)
// สคริปต์ธรรมดา (ไม่ใช่ module) — ทำงานก่อนโหลดโมดูลของแอป

(function () {
  'use strict';

  var Vault = window.IfyVault;
  var KEY_DB = 'ify-studio-vault';
  var STORE = 'keys';
  var KEY_ID = 'kek';
  var BUNDLE_URL = 'studio.enc';

  var $ = function (id) { return document.getElementById(id); };
  var form = $('vault-form');
  var input = $('vault-password');
  var remember = $('vault-remember');
  var msg = $('vault-msg');
  var go = $('vault-go');
  var failures = 0;

  function setMsg(text, kind) {
    msg.textContent = text || '';
    msg.className = 'vault-msg' + (kind ? ' ' + kind : '');
  }

  function busy(on, text) {
    go.disabled = on;
    input.disabled = on;
    go.textContent = on ? (text || 'กำลังตรวจรหัส...') : 'ปลดล็อก';
  }

  // ---------- ที่เก็บกุญแจในเครื่อง ----------
  function keyDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(KEY_DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function keyOp(mode, fn) {
    return keyDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var req = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { db.close(); resolve(req.result); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      });
    });
  }

  var loadKey = function () { return keyOp('readonly', function (s) { return s.get(KEY_ID); }).catch(function () { return null; }); };
  var saveKey = function (rec) { return keyOp('readwrite', function (s) { return s.put(rec, KEY_ID); }); };
  var clearKey = function () { return keyOp('readwrite', function (s) { return s.delete(KEY_ID); }).catch(function () {}); };

  // ---------- เริ่มแอปจากโมดูลที่ถอดรหัสแล้ว ----------
  function boot(text) {
    var bundle = JSON.parse(text);
    var siteRoot = new URL('../', location.href);
    var urls = {};
    // ลำดับใน bundle.order: โมดูลที่ถูก import มาก่อนผู้ import เสมอ (ตรวจตอนสร้างเว็บ)
    bundle.order.forEach(function (rel) {
      var code = bundle.files[rel].replace(/@ify:([A-Za-z0-9._/-]+)/g, function (m, dep) {
        return urls[dep] || new URL(dep, siteRoot).href;
      });
      urls[rel] = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    });
    document.body.dataset.vault = 'open';
    return import(urls[bundle.entry]);
  }

  function showError(err) {
    document.body.dataset.vault = 'locked';
    busy(false);
    setMsg('เปิดแอปไม่สำเร็จ: ' + (err && err.message ? err.message : String(err)), 'error');
  }

  var envelope = fetch(BUNDLE_URL, { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error('โหลดไฟล์ข้อมูลไม่สำเร็จ (' + r.status + ')');
    return r.json();
  });

  async function unlockWithStoredKey() {
    var rec = await loadKey();
    if (!rec || !rec.kek) return false;
    var env = await envelope;
    // รหัสผ่านถูกเปลี่ยน (salt ใหม่) → กุญแจเดิมใช้ไม่ได้ ต้องกรอกใหม่
    if (rec.salt !== env.kdf.salt) {
      await clearKey();
      return false;
    }
    try {
      var text = await Vault.openWithKek(env, rec.kek);
      await boot(text);
      return true;
    } catch (err) {
      if (err && err.code === 'BAD_PASSWORD') {
        await clearKey();
        return false;
      }
      throw err;
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (go.disabled) return;
    var password = input.value;
    if (!password) {
      setMsg('กรุณากรอกรหัสผ่าน', 'error');
      input.focus();
      return;
    }
    busy(true);
    setMsg('');
    try {
      var env = await envelope;
      var kek = await Vault.kekFor(env, password);
      var text = await Vault.openWithKek(env, kek);
      input.value = '';
      if (remember.checked) await saveKey({ kek: kek, salt: env.kdf.salt, savedAt: new Date().toISOString() }).catch(function () {});
      else await clearKey();
      busy(true, 'กำลังเปิด...');
      await boot(text);
    } catch (err) {
      if (err && err.code === 'BAD_PASSWORD') {
        failures += 1;
        // หน่วงเวลาเพิ่มขึ้นเมื่อกรอกผิดซ้ำ
        var wait = Math.min(failures, 5) * 1000;
        setMsg('รหัสผ่านไม่ถูกต้อง' + (failures > 1 ? ' (ครั้งที่ ' + failures + ')' : ''), 'error');
        input.select();
        setTimeout(function () { busy(false); input.focus(); }, wait);
        return;
      }
      showError(err);
    }
  });

  $('vault-lock').addEventListener('click', async function () {
    await clearKey();
    location.reload();
  });

  (async function start() {
    if (!Vault || !window.crypto || !window.crypto.subtle) {
      setMsg('เบราว์เซอร์นี้ไม่รองรับการเข้ารหัส — เปิดผ่านลิงก์ https ด้วย Safari หรือ Chrome รุ่นปัจจุบัน', 'error');
      busy(true, 'ใช้งานไม่ได้');
      return;
    }
    busy(true, 'กำลังเปิด...');
    try {
      if (await unlockWithStoredKey()) return;
      await envelope;
      busy(false);
      document.body.dataset.ready = 'locked';
      input.focus();
    } catch (err) {
      showError(err);
    }
  })();
})();
