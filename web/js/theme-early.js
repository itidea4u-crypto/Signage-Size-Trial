// ตั้งธีมตามเครื่องก่อนหน้าแสดงผล (สคริปต์ธรรมดาใน <head>) — ไม่ให้หน้าแวบเป็นธีมสว่างแล้วค่อยเปลี่ยนเป็นมืด
document.documentElement.dataset.theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
