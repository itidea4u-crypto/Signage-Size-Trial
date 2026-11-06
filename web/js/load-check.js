// ตรวจว่าแอปเปิดสำเร็จหรือไม่ (สคริปต์ธรรมดา ไม่ใช่โมดูล — ทำงานได้แม้เบราว์เซอร์เก่าเกินจะโหลดตัวแอป)
// ถ้าผ่านไป 10 วินาทีแล้วแอปยังไม่พร้อม ให้แจ้งวิธีแก้ แทนการค้างที่ "กำลังเปิดแอป…"
(function () {
  setTimeout(function () {
    if (document.body.getAttribute('data-ready')) return;
    var box = document.querySelector('.m-loading');
    if (!box) return;
    box.textContent = 'เปิดแอปไม่สำเร็จ — เบราว์เซอร์อาจเก่าเกินไป กรุณาอัปเดตระบบ (iPhone/iPad: iOS 15.4 ขึ้นไป · Android: Chrome รุ่นล่าสุด) แล้วเปิดใหม่';
    box.setAttribute('role', 'alert');
  }, 10000);
})();
