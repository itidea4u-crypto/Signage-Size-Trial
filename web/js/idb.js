// ที่เก็บข้อมูลในเครื่องของเวอร์ชันมือถือ: IndexedDB ของเบราว์เซอร์ (ไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์)
// - projects: งานแต่ละชิ้น (รวมภาพอ้างอิงแบบ data URL)
// - kv: การตั้งค่าและสถานะเล็ก ๆ เช่น งานที่เปิดค้างไว้
// - dimensionJobs: งาน "ภาพแสดงขนาดป้าย" (ภาพต้นฉบับ ขนาด กรอบวัด) — เพิ่มในรุ่นที่ 2 ของที่เก็บข้อมูล
// - trash / backups: ถังขยะโครงการ และไฟล์สำรองในเบราว์เซอร์ ของเว็บ AI Design Studio (web/js/studio-api.js) — เพิ่มในรุ่นที่ 3

const DB_NAME = 'ideaforyou-mobile';
const DB_VERSION = 3;

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('บันทึกข้อมูลในเครื่องไม่สำเร็จ'));
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      // รุ่นที่ 2: เพิ่มที่เก็บใหม่เท่านั้น — งานและการตั้งค่าเดิมไม่ถูกแตะ
      if (!db.objectStoreNames.contains('dimensionJobs')) db.createObjectStore('dimensionJobs', { keyPath: 'id' });
      // รุ่นที่ 3: เพิ่มที่เก็บใหม่เท่านั้น
      if (!db.objectStoreNames.contains('trash')) db.createObjectStore('trash', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // หน้าต่างอื่นของแอปที่เปิดรุ่นใหม่กว่า → ปิดการเชื่อมต่อนี้ให้ (ไม่ให้อีกหน้าต่างค้าง)
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('เปิดที่เก็บข้อมูลในเครื่องไม่ได้'));
    req.onblocked = () => reject(new Error('ที่เก็บข้อมูลถูกใช้อยู่ในหน้าต่างอื่น — ปิดหน้าต่างอื่นของแอปแล้วลองใหม่'));
  });
}

/** ที่เก็บข้อมูลแบบ IndexedDB — รูปแบบเดียวกับ memoryBackend() ใน web-api.js */
export function idbBackend() {
  const dbp = openDb();
  const run = async (store, mode, fn) => {
    const db = await dbp;
    const tx = db.transaction(store, mode);
    const result = await promisify(fn(tx.objectStore(store)));
    if (mode === 'readwrite') {
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('บันทึกไม่สำเร็จ — พื้นที่ในเครื่องอาจเต็ม'));
      });
    }
    return result;
  };
  return {
    allProjects: () => run('projects', 'readonly', (s) => s.getAll()),
    getProject: (id) => run('projects', 'readonly', (s) => s.get(id)),
    putProject: (p) => run('projects', 'readwrite', (s) => s.put(p)),
    deleteProject: (id) => run('projects', 'readwrite', (s) => s.delete(id)),
    getKv: (key) => run('kv', 'readonly', (s) => s.get(key)),
    setKv: (key, value) => run('kv', 'readwrite', (s) => s.put(value, key)),
    allDimensionJobs: () => run('dimensionJobs', 'readonly', (s) => s.getAll()),
    getDimensionJob: (id) => run('dimensionJobs', 'readonly', (s) => s.get(id)),
    putDimensionJob: (job) => run('dimensionJobs', 'readwrite', (s) => s.put(job)),
    deleteDimensionJob: (id) => run('dimensionJobs', 'readwrite', (s) => s.delete(id)),
    allTrash: () => run('trash', 'readonly', (s) => s.getAll()),
    getTrash: (id) => run('trash', 'readonly', (s) => s.get(id)),
    putTrash: (p) => run('trash', 'readwrite', (s) => s.put(p)),
    deleteTrash: (id) => run('trash', 'readwrite', (s) => s.delete(id)),
    allBackups: () => run('backups', 'readonly', (s) => s.getAll()),
    getBackup: (key) => run('backups', 'readonly', (s) => s.get(key)),
    putBackup: (b) => run('backups', 'readwrite', (s) => s.put(b)),
    deleteBackup: (key) => run('backups', 'readwrite', (s) => s.delete(key)),
  };
}
