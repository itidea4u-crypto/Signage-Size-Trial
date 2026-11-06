// กล่องเข้ารหัส "ความรู้ของบริษัท" สำหรับเว็บ IdeaForYou AI Design Studio
// (ระบบสร้าง Prompt, Workflow, Skill และโค้ดหน้าจอที่ใช้ส่วนเหล่านี้)
//
// มาตรฐานที่ใช้ (Web Crypto — มีในเบราว์เซอร์ทุกตัวที่รองรับ และใน Node.js 20+):
//   - รหัสผ่าน → กุญแจห่อ (KEK): PBKDF2-SHA-256, salt สุ่ม 16 ไบต์, 600,000 รอบ → AES-256-GCM
//   - เนื้อหา: เข้ารหัสด้วยกุญแจข้อมูล (DEK) AES-256-GCM สุ่มใหม่ทุกครั้งที่สร้างเว็บ, IV สุ่ม 12 ไบต์
//   - DEK ถูกห่อด้วย KEK (AES-GCM) — ไฟล์เว็บมีเพียง salt, IV และข้อมูลที่เข้ารหัสแล้ว ไม่มีรหัสผ่านหรือกุญแจ
//   - GCM ตรวจความถูกต้องในตัว: รหัสผิดหรือไฟล์ถูกแก้ → ถอดรหัสไม่ได้ (ไม่ได้ข้อมูลผิด ๆ ออกมา)
//
// ไฟล์นี้เป็นสคริปต์ธรรมดา (ไม่ใช่ module) เพราะต้องทำงานก่อนโหลดโมดูลของแอป
// ใช้ร่วมกันโดย: หน้าเว็บ (web/js/studio-loader.js), ตัวสร้างเว็บ (scripts/build-web.mjs) และการทดสอบ

(function (root) {
  'use strict';

  var FORMAT = 'ify-vault';
  var VERSION = 1;
  var DEFAULT_ITERATIONS = 600000;
  var MIN_ITERATIONS = 100000;

  function subtle() {
    var c = root.crypto;
    if (!c || !c.subtle) throw new Error('เบราว์เซอร์นี้ไม่รองรับการเข้ารหัส (ต้องเปิดผ่าน https)');
    return c.subtle;
  }

  function randomBytes(n) {
    var b = new Uint8Array(n);
    root.crypto.getRandomValues(b);
    return b;
  }

  function toB64(bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return root.btoa(s);
  }

  function fromB64(text) {
    var s = root.atob(String(text));
    var u8 = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i += 1) u8[i] = s.charCodeAt(i);
    return u8;
  }

  function utf8(text) {
    return new TextEncoder().encode(text);
  }

  // ข้อมูลส่วนหัวที่ผูกกับการเข้ารหัส (AAD) — แก้ส่วนหัวแล้วถอดรหัสไม่ได้
  function aad(env, part) {
    return utf8([FORMAT, env.v, env.id, part].join('|'));
  }

  /**
   * รหัสผ่าน → กุญแจห่อ (KEK) แบบดึงออกไม่ได้ (non-extractable) ใช้ได้เฉพาะแกะกุญแจข้อมูล
   * @param {string} password
   * @param {Uint8Array} salt
   * @param {number} iterations
   * @param {string[]} [usages]
   */
  async function deriveKek(password, salt, iterations, usages) {
    if (typeof password !== 'string' || password.length === 0) throw new Error('กรุณากรอกรหัสผ่าน');
    if (!(iterations >= MIN_ITERATIONS)) throw new Error('จำนวนรอบของ PBKDF2 ต่ำเกินไป');
    var base = await subtle().importKey('raw', utf8(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iterations },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      usages || ['wrapKey', 'unwrapKey'],
    );
  }

  /**
   * เข้ารหัสข้อความ (ใช้ตอนสร้างเว็บ)
   * @param {{ password: string, salt: Uint8Array, plaintext: string, iterations?: number }} opts
   * @returns {Promise<object>} ซองข้อมูล (JSON) — ไม่มีรหัสผ่านหรือกุญแจ
   */
  async function seal(opts) {
    var iterations = opts.iterations || DEFAULT_ITERATIONS;
    if (!(opts.salt instanceof Uint8Array) || opts.salt.length < 16) throw new Error('salt ต้องยาวอย่างน้อย 16 ไบต์');
    var env = { format: FORMAT, v: VERSION, id: toB64(randomBytes(12)) };
    var kek = await deriveKek(opts.password, opts.salt, iterations, ['wrapKey']);
    var dek = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    var wrapIv = randomBytes(12);
    var wrapped = await subtle().wrapKey('raw', dek, kek, { name: 'AES-GCM', iv: wrapIv, additionalData: aad(env, 'key') });
    var dataIv = randomBytes(12);
    var ct = await subtle().encrypt({ name: 'AES-GCM', iv: dataIv, additionalData: aad(env, 'data') }, dek, utf8(opts.plaintext));
    env.kdf = { name: 'PBKDF2', hash: 'SHA-256', iterations: iterations, salt: toB64(opts.salt) };
    env.key = { alg: 'AES-GCM', iv: toB64(wrapIv), wrapped: toB64(wrapped) };
    env.data = { alg: 'AES-GCM', iv: toB64(dataIv), ct: toB64(ct) };
    return env;
  }

  function checkEnvelope(env) {
    if (!env || env.format !== FORMAT || env.v !== VERSION || !env.kdf || !env.key || !env.data) {
      throw new Error('ไฟล์ข้อมูลที่เข้ารหัสไม่ถูกต้อง');
    }
  }

  /** กุญแจห่อจากรหัสผ่าน ตามค่าในซองข้อมูล (salt/รอบ) */
  async function kekFor(env, password) {
    checkEnvelope(env);
    return deriveKek(password, fromB64(env.kdf.salt), env.kdf.iterations, ['unwrapKey']);
  }

  /**
   * ถอดรหัสด้วยกุญแจห่อ — รหัสผ่านผิดหรือไฟล์ถูกแก้ จะได้ข้อผิดพลาด code = 'BAD_PASSWORD'
   * @returns {Promise<string>}
   */
  async function openWithKek(env, kek) {
    checkEnvelope(env);
    var dek;
    try {
      dek = await subtle().unwrapKey('raw', fromB64(env.key.wrapped), kek, { name: 'AES-GCM', iv: fromB64(env.key.iv), additionalData: aad(env, 'key') },
        { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    } catch (e) {
      var err = new Error('รหัสผ่านไม่ถูกต้อง');
      err.code = 'BAD_PASSWORD';
      throw err;
    }
    var plain;
    try {
      plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(env.data.iv), additionalData: aad(env, 'data') }, dek, fromB64(env.data.ct));
    } catch (e) {
      var err2 = new Error('ไฟล์ข้อมูลเสียหายหรือถูกแก้ไข');
      err2.code = 'CORRUPT';
      throw err2;
    }
    return new TextDecoder().decode(plain);
  }

  async function open(env, password) {
    return openWithKek(env, await kekFor(env, password));
  }

  root.IfyVault = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    DEFAULT_ITERATIONS: DEFAULT_ITERATIONS,
    seal: seal,
    open: open,
    kekFor: kekFor,
    openWithKek: openWithKek,
    randomBytes: randomBytes,
    toB64: toB64,
    fromB64: fromB64,
  };
})(globalThis);
