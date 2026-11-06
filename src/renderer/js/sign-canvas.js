// เมนู "ภาพแสดงขนาดป้าย" — ส่วนวาดภาพด้วย canvas (ทำงานในหน้าจอ)
// ภาพป้ายถูกวางแบบ 1:1 ด้วย putImageData (ไม่ย่อ/ขยาย/ปรับสี) แล้ววาดเส้นวัดบนพื้นที่โปร่งใสรอบ ๆ
// ภาพที่ได้มีเฉพาะ ภาพป้าย + เส้นประ + ลูกศร + ตัวเลขขนาด และหมายเหตุประเภทขนาดเมื่อมีค่าประมาณ/ค่าแนะนำ
// — หน้าพรีวิวแสดง canvas เดียวกับที่ส่งออก (ตำแหน่งเส้นและตัวเลขจึงตรงกัน)
// ตำแหน่งเส้นวัดทั้งหมดคำนวณใน shared/sign-scale.js (measureLayout) — ไฟล์นี้วาดอย่างเดียว

// ฟอนต์ไทยของโปรแกรม (ประกาศใน styles/fonts.css) — ตัวเลขบนภาพจึงเหมือนกันทุกเครื่อง
const FONT_FAMILY = 'IBM Plex Sans Thai';
let fontsReady = null;

// canvas ไม่รอฟอนต์เอง ต้องโหลดน้ำหนักที่ใช้ (ไทย + ตัวเลข) ให้เสร็จก่อนวาด
export function loadFonts() {
  if (!fontsReady) {
    fontsReady = Promise.all(['500', '600'].map((w) => document.fonts.load(`${w} 20px "${FONT_FAMILY}"`, 'ประมาณ 0123456789 cm'))).catch(() => null);
  }
  return fontsReady;
}

/** อ่านไฟล์ภาพเป็นพิกเซล RGBA โดยไม่แปลงโปรไฟล์สีและไม่คูณค่าโปร่งใสล่วงหน้า */
export async function decodeFile(file) {
  const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  // Safari ก่อน iOS 16.4 ไม่มี OffscreenCanvas → ใช้ canvas ปกติ (ผลเหมือนกัน)
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bitmap.width, bitmap.height) : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return { rgba: data.data, width: data.width, height: data.height };
}

/** ตัดภาพตามกรอบแบบ 1:1 — ลบพื้นหลังเฉพาะเมื่อผู้ใช้ยืนยัน (พิกเซลพื้นหลังกลายเป็นโปร่งใส ส่วนอื่นไม่แตะ) */
export function cropPixels(rgba, w, box, mask, removeBackground) {
  const out = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    const src = ((box.y + y) * w + box.x) * 4;
    out.set(rgba.subarray(src, src + box.width * 4), y * box.width * 4);
    if (removeBackground && mask) {
      for (let x = 0; x < box.width; x += 1) {
        if (mask[(box.y + y) * w + box.x + x]) out[(y * box.width + x) * 4 + 3] = 0;
      }
    }
  }
  return out;
}

const THEMES = {
  dark: { line: '#2b2b33', halo: 'rgba(255,255,255,0.92)' },
  light: { line: '#f2f2f5', halo: 'rgba(0,0,0,0.78)' },
};

/**
 * สร้างภาพผลลัพธ์บน canvas (ใช้ทั้งพรีวิวและไฟล์ PNG ที่ส่งออก)
 * crop = พิกเซลภาพตามกรอบ cropBox (1:1) · layout จาก measureLayout() · signBox = กรอบป้ายรวม (เส้นประรอบป้าย)
 * theme = สีเส้นวัด: dark (เส้นเข้ม สำหรับป้ายพื้นสว่าง) · light (เส้นอ่อน สำหรับป้ายพื้นเข้ม)
 * เส้นวัดและตัวเลขอยู่นอกพื้นที่ภาพ — เฉพาะเส้นประนำสายตาของกรอบวัดภายในป้ายที่ลากผ่านบนภาพ
 * @returns {{ canvas: HTMLCanvasElement, layout: object }}
 */
export function renderMeasured({ crop, cropBox, signBox, layout, theme = 'dark', bounds = [] }) {
  const canvas = document.createElement('canvas');
  canvas.width = layout.canvas.width;
  canvas.height = layout.canvas.height;
  const ctx = canvas.getContext('2d');
  // ภาพป้ายแบบ 1:1 — วางก่อน
  ctx.putImageData(new ImageData(crop, cropBox.width, cropBox.height), layout.image.x, layout.image.y);
  const X = (x) => layout.image.x + (x - cropBox.x);
  const Y = (y) => layout.image.y + (y - cropBox.y);

  const t = THEMES[theme] || THEMES.dark;
  const s = layout.stroke;
  const withHalo = (draw) => {
    ctx.save();
    ctx.strokeStyle = t.halo;
    ctx.fillStyle = t.halo;
    ctx.lineWidth = s + 3;
    draw(true);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = t.line;
    ctx.fillStyle = t.line;
    ctx.lineWidth = s;
    draw(false);
    ctx.restore();
  };

  // เส้นประขอบเขตของป้ายรวม (ห่างจากขอบป้าย gap พิกเซล — ไม่ทับป้าย)
  if (signBox && layout.dims.some((d) => d.overall)) {
    const g = layout.gap;
    withHalo(() => {
      ctx.setLineDash([s * 4, s * 3]);
      ctx.strokeRect(X(signBox.x) - g + 0.5, Y(signBox.y) - g + 0.5, signBox.width + g * 2 - 1, signBox.height + g * 2 - 1);
    });
  }

  const head = layout.arrowHead;
  const arrowHead = (x, y, dx, dy, halo) => {
    // dx, dy = ทิศที่หัวลูกศรชี้
    const px = -dy;
    const py = dx;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * head + px * head * 0.45, y - dy * head + py * head * 0.45);
    ctx.lineTo(x - dx * head - px * head * 0.45, y - dy * head - py * head * 0.45);
    ctx.closePath();
    if (halo) ctx.stroke();
    ctx.fill();
  };
  const line = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const tick = Math.round(head * 0.8);
  const g = layout.gap;
  // พื้นที่ตัวเลขของทุกเส้น — เส้นและเส้นนำสายตาเว้นช่วงนี้ (ตัวเลขไม่ถูกเส้นอื่นลากทับ)
  const labelRects = [];
  for (const d of layout.dims) {
    const pad = Math.max(3, Math.round(d.fontSize * 0.15));
    if (d.horizontal) {
      ctx.font = `600 ${d.fontSize}px "${FONT_FAMILY}", sans-serif`;
      const w = ctx.measureText(d.label).width;
      const top = d.side === 'top' ? d.labelY - d.fontSize * 1.1 : d.labelY;
      labelRects.push([d.labelX - w / 2 - pad, top - pad / 2, w + pad * 2, d.fontSize * 1.1 + pad]);
    } else {
      const n = d.lines.length;
      d.lines.forEach((l, i) => {
        const size = i === 0 ? d.fontSize : Math.round(d.fontSize * 0.85);
        ctx.font = `${i === 0 ? 600 : 500} ${size}px "${FONT_FAMILY}", sans-serif`;
        const w = ctx.measureText(l).width;
        const cy = d.labelY + (i - (n - 1) / 2) * d.lineHeight;
        labelRects.push([(d.side === 'left' ? d.labelX - w : d.labelX) - pad, cy - size * 0.6 - pad / 2, w + pad * 2, size * 1.2 + pad]);
      });
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  for (const [x, y, w, hh] of labelRects) ctx.rect(x, y, w, hh);
  ctx.clip('evenodd');

  // เส้นปะขอบเขตการวัด (สีขาว ขอบเข้ม — เห็นชัดทั้งบนพื้นเข้มและพื้นสว่าง) · อยู่ในพื้นที่ตัด จึงไม่ทับตัวเลข
  // กรอบ: สี่เหลี่ยมรอบกรอบที่ผู้ใช้กำหนด (ห่างออกเล็กน้อย ไม่ทับขอบชิ้นงาน) · เส้น: เส้นปะขวางที่ปลายทั้งสองของระยะที่วัด
  if (bounds.length) {
    const bw = Math.max(1.5, s * 0.75);
    const o = Math.ceil(bw / 2) + 1;
    const dash = [s * 4, s * 3];
    const strokeAll = (width, color) => {
      ctx.save();
      ctx.setLineDash(dash);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.lineCap = 'butt';
      for (const b of bounds) {
        ctx.beginPath();
        if (b.kind === 'rect') ctx.rect(X(b.x) - o, Y(b.y) - o, b.w + o * 2, b.h + o * 2);
        else if (b.axis === 'x') {
          for (const u of [b.a, b.b]) {
            ctx.moveTo(X(u), Y(b.v1));
            ctx.lineTo(X(u), Y(b.v2));
          }
        } else {
          for (const u of [b.a, b.b]) {
            ctx.moveTo(X(b.v1), Y(u));
            ctx.lineTo(X(b.v2), Y(u));
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    };
    strokeAll(bw + 2.5, 'rgba(20,20,28,0.85)');
    strokeAll(bw, '#ffffff');
  }

  for (const d of layout.dims) {
    // ทิศจากภาพออกไปหาเส้นวัด
    const dir = d.side === 'top' || d.side === 'left' ? -1 : 1;
    // เส้นนำสายตา: ขนาดรวมเริ่มนอกขอบป้าย · กรอบภายในเริ่มที่ขอบกรอบ (เส้นประบาง ลากผ่านบนภาพ)
    const extStart = d.overall ? d.extFrom + dir * (g + 2) : d.extFrom;
    // เส้นวัดทีละเส้น: เส้นนำสายตาแต่ละข้างเริ่มห่างจากขอบสิ่งที่วัดเล็กน้อย (ไม่แตะตัวอักษร)
    const ext1 = d.ext1 != null ? d.ext1 + dir * g : extStart;
    const ext2 = d.ext2 != null ? d.ext2 + dir * g : extStart;
    if (d.horizontal) {
      withHalo((halo) => {
        if (!d.overall) ctx.setLineDash([s * 3, s * 2]);
        if (!d.overall) ctx.lineWidth = halo ? Math.max(1, s * 0.6) + 2 : Math.max(1, s * 0.6);
        line(d.x1, ext1, d.x1, d.y + dir * tick);
        line(d.x2, ext2, d.x2, d.y + dir * tick);
        ctx.setLineDash([]);
        ctx.lineWidth = halo ? s + 3 : s;
        line(d.x1 + head * 0.6, d.y, d.x2 - head * 0.6, d.y);
        arrowHead(d.x1, d.y, -1, 0, halo);
        arrowHead(d.x2, d.y, 1, 0, halo);
      });
    } else {
      withHalo((halo) => {
        if (!d.overall) ctx.setLineDash([s * 3, s * 2]);
        if (!d.overall) ctx.lineWidth = halo ? Math.max(1, s * 0.6) + 2 : Math.max(1, s * 0.6);
        line(ext1, d.y1, d.x + dir * tick, d.y1);
        line(ext2, d.y2, d.x + dir * tick, d.y2);
        ctx.setLineDash([]);
        ctx.lineWidth = halo ? s + 3 : s;
        line(d.x, d.y1 + head * 0.6, d.x, d.y2 - head * 0.6);
        arrowHead(d.x, d.y1, 0, -1, halo);
        arrowHead(d.x, d.y2, 0, 1, halo);
      });
    }
  }

  ctx.restore();

  const text = (str, x, y, size, weight, align, baseline, rotate = 0) => {
    if (!str) return;
    ctx.save();
    ctx.translate(x, y);
    if (rotate) ctx.rotate(rotate);
    ctx.font = `${weight} ${size}px "${FONT_FAMILY}", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, Math.round(size * 0.18));
    ctx.strokeStyle = t.halo;
    ctx.strokeText(str, 0, 0);
    ctx.fillStyle = t.line;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };
  for (const d of layout.dims) {
    // ช่วงสั้นใช้ตัวเลขเล็กลง (fontSize จาก measureLayout)
    if (d.horizontal) text(d.label, d.labelX, d.labelY, d.fontSize, 600, 'center', d.side === 'top' ? 'bottom' : 'top');
    else {
      // ความสูง: ตัวเลขแนวนอนข้างลูกศร (ด้านนอก) — ค่าประมาณขึ้นบรรทัดที่สอง "(ประมาณ)"
      const n = d.lines.length;
      d.lines.forEach((l, i) => text(l, d.labelX, d.labelY + (i - (n - 1) / 2) * d.lineHeight, i === 0 ? d.fontSize : Math.round(d.fontSize * 0.85), i === 0 ? 600 : 500, d.side === 'left' ? 'right' : 'left', 'middle'));
    }
  }
  // หมายเหตุประเภทขนาด (เฉพาะเมื่อมีค่าประมาณ/ค่าแนะนำ) — ชิดซ้ายใต้เส้นวัด
  for (const n of layout.notes || []) text(n.text, n.x, n.y, n.fontSize, 500, 'left', 'top');
  return { canvas, layout };
}

export function canvasToPng(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('สร้างไฟล์ PNG ไม่สำเร็จ'))), 'image/png'));
}
