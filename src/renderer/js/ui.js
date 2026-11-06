// ส่วนประกอบหน้าจอที่ใช้ทั่วโปรแกรม: การแจ้งเตือน (toast) และกล่องโต้ตอบ (modal)

import { h, icon } from './dom.js';

const TOAST_ICON = { ok: 'check', error: 'alert', warn: 'alert', info: 'info' };

export function toast(message, type = 'ok', ms = 2800) {
  const root = document.getElementById('toasts');
  const el = h('div', { class: `toast toast-${type}`, role: 'status' }, icon(TOAST_ICON[type] || 'info'), h('span', {}, message));
  root.append(el);
  setTimeout(() => el.remove(), type === 'error' ? Math.max(ms, 6000) : ms);
}

export function toastError(err, prefix = '') {
  const msg = err?.message || String(err);
  toast(prefix ? `${prefix}: ${msg}` : msg, 'error');
}

/**
 * เปิดกล่องโต้ตอบ — คืนค่า value ของปุ่มที่กด หรือ null ถ้าปิด
 * ปุ่มที่มี onClick: ถ้าคืน false กล่องจะยังไม่ปิด (ใช้ตรวจความถูกต้องของฟอร์ม)
 */
export function modal({ title, body, actions = [{ label: 'ปิด', value: null }], size = '' }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    let done = false;
    const close = (value) => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(null);
      }
    };
    const buttons = actions.map((a) =>
      h(
        'button',
        {
          class: `btn ${a.kind ? `btn-${a.kind}` : ''}`,
          'data-action': a.id || '',
          onclick: async () => {
            if (a.onClick) {
              const r = await a.onClick();
              if (r === false) return;
            }
            close(a.value === undefined ? true : a.value);
          },
        },
        a.label,
      ),
    );
    const dialog = h(
      'div',
      { class: `modal ${size ? `modal-${size}` : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, title),
      h('div', { class: 'modal-body' }, typeof body === 'string' ? h('p', {}, body) : body),
      h('div', { class: 'modal-foot' }, buttons),
    );
    const backdrop = h('div', { class: 'modal-backdrop', onmousedown: (e) => e.target === backdrop && close(null) }, dialog);
    root.append(backdrop);
    document.addEventListener('keydown', onKey, true);
    const focusTarget = dialog.querySelector('input, textarea, select') || buttons[buttons.length - 1];
    setTimeout(() => focusTarget?.focus(), 0);
  });
}

export async function confirmDialog({ title, message, okLabel = 'ตกลง', danger = false }) {
  const r = await modal({
    title,
    body: message,
    actions: [
      { label: 'ยกเลิก', value: false, id: 'cancel' },
      { label: okLabel, value: true, kind: danger ? 'danger' : 'primary', id: 'ok' },
    ],
  });
  return r === true;
}
