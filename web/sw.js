// service worker ของเวอร์ชันมือถือ: เก็บไฟล์ของแอปไว้ในเครื่อง เพื่อเปิดใช้ได้แม้ไม่มีอินเทอร์เน็ต
// ไม่เก็บหรือส่งข้อมูลลูกค้า (ข้อมูลงานอยู่ใน IndexedDB) — scripts/build-web.mjs ใส่ชื่อชุดไฟล์และรายการไฟล์ให้ตอนสร้าง

const CACHE = "ify-mobile-660234e5e11f";
const FILES = [
  "./",
  "../src/renderer/assets/fonts/OFL-LICENSE.txt",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-latin-400-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-latin-500-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-latin-600-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-latin-700-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-latin-ext-400-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-latin-ext-500-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-latin-ext-600-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-latin-ext-700-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-thai-400-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-thai-500-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-thai-600-normal.woff2",
  "../src/renderer/assets/fonts/ibm-plex-sans-thai-thai-700-normal.woff2",
  "../src/renderer/assets/logo.svg",
  "../src/renderer/js/dom.js",
  "../src/renderer/js/pages/sign-dimensions.js",
  "../src/renderer/js/sign-canvas.js",
  "../src/renderer/js/ui.js",
  "../src/renderer/styles/app.css",
  "../src/renderer/styles/fonts.css",
  "../src/shared/constants.js",
  "../src/shared/dimension-job.js",
  "../src/shared/print-file.js",
  "../src/shared/project-model.js",
  "../src/shared/sign-dimensions.js",
  "../src/shared/sign-scale.js",
  "../src/shared/sign-size.js",
  "../src/shared/size-lines.js",
  "../src/shared/size-parts.js",
  "../src/shared/size-suggest.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./js/idb.js",
  "./js/load-check.js",
  "./js/polyfills.js",
  "./js/size-api.js",
  "./js/size-boot.js",
  "./js/size-main.js",
  "./js/studio-loader.js",
  "./js/theme-early.js",
  "./js/vault.js",
  "./js/version.js",
  "./manifest.webmanifest",
  "./size.html",
  "./studio.enc",
  "./studio.html",
  "./styles/size-web.css",
  "./styles/studio-web.css"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ify-mobile-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      // เปิดหน้าแอปขณะออฟไลน์ → ใช้หน้าหลักที่เก็บไว้
      if (req.mode === 'navigate') return caches.match('./index.html').then((page) => page || fetch(req));
      return fetch(req);
    }),
  );
});
