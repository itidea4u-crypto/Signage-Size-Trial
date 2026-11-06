// ตัวช่วยสร้าง DOM แบบปลอดภัย (ไม่ใช้ innerHTML กับข้อมูลผู้ใช้) และชุดไอคอนของโปรแกรม

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  let deferredValue;
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') deferredValue = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'multiple') el[k] = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

const P = (d) => ['path', { d }];
const ICONS = {
  bolt: [P('M13 2 4 14h7l-1 8 9-12h-7l1-8z')],
  layout: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }], P('M3 9h18M9 21V9')],
  folder: [P('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z')],
  sliders: [P('M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12'), ['circle', { cx: 16, cy: 6, r: 2 }], ['circle', { cx: 10, cy: 12, r: 2 }], ['circle', { cx: 18, cy: 18, r: 2 }]],
  plus: [P('M12 5v14M5 12h14')],
  save: [P('M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v5h8V3M7 21v-7h10v7')],
  copy: [['rect', { x: 8, y: 8, width: 13, height: 13, rx: 2 }], P('M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3')],
  trash: [P('M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6')],
  search: [['circle', { cx: 11, cy: 11, r: 7 }], P('M20 20l-4-4')],
  up: [P('M12 19V5M5 12l7-7 7 7')],
  down: [P('M12 5v14M19 12l-7 7-7-7')],
  external: [P('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')],
  image: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }], ['circle', { cx: 9, cy: 9, r: 2 }], P('M21 15l-5-5L5 21')],
  text: [P('M4 7V4h16v3M12 4v16M9 20h6')],
  square: [['rect', { x: 4, y: 4, width: 16, height: 16, rx: 3 }]],
  download: [P('M12 3v12M7 10l5 5 5-5M5 21h14')],
  upload: [P('M12 21V9M7 14l5-5 5 5M5 3h14')],
  restore: [P('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5')],
  check: [P('M5 12l5 5L20 7')],
  x: [P('M6 6l12 12M18 6 6 18')],
  alert: [P('M12 3l10 18H2zM12 10v4M12 17.5v.5')],
  info: [['circle', { cx: 12, cy: 12, r: 9 }], P('M12 11v6M12 7.5v.5')],
  grip: [6, 12, 18].flatMap((y) => [['circle', { cx: 9, cy: y, r: 1.3, fill: 'currentColor' }], ['circle', { cx: 15, cy: y, r: 1.3, fill: 'currentColor' }]]),
  sparkles: [P('M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z')],
  file: [P('M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h6')],
  edit: [P('M4 20h4L19 9l-4-4L4 16zM14 6l4 4')],
  grid: [P('M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18')],
  list: [P('M4 6h16M4 12h10M4 18h7')],
  lock: [['rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }], P('M8 11V7a4 4 0 0 1 8 0v4')],
  layers: [P('M12 3l9 5-9 5-9-5zM3 13l9 5 9-5')],
  refresh: [P('M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4')],
  shield: [P('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z')],
  sun: [['circle', { cx: 12, cy: 12, r: 4 }], P('M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')],
  moon: [P('M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z')],
  chevron: [P('M6 9l6 6 6-6')],
  clip: [P('M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9')],
  checkCircle: [['circle', { cx: 12, cy: 12, r: 9 }], P('M8 12.5l2.7 2.7L16 10')],
  wand: [P('M4 20 16 8M14 6l4 4M18 3v3M16.5 4.5h3M7 4v2M6 5h2M19 15v2M18 16h2')],
  send: [P('M21 3 10 14M21 3l-7 18-4-7-7-4z')],
  ruler: [['rect', { x: 2, y: 7, width: 20, height: 10, rx: 2 }], P('M6 7v4M10 7v3M14 7v4M18 7v3')],
  front: [['rect',{ x: 8, y: 8, width: 12, height: 12, rx: 2, fill: 'currentColor', 'fill-opacity': 0.25 }], P('M4 16V5a1 1 0 0 1 1-1h11')],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function icon(name, cls = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  for (const [tag, attrs] of ICONS[name] || []) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) child.setAttribute(k, String(v));
    svg.append(child);
  }
  return svg;
}

const dateFmt = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d);
}

export function formatBytes(n) {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
