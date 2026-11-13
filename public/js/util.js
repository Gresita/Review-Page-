import { t } from './i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtTime(sec) {
  if (!Number.isFinite(sec)) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function fmtDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtLeft(ms) {
  const d = Math.max(0, ms);
  const days = Math.floor(d / 86400000);
  const hours = Math.floor((d % 86400000) / 3600000);
  const mins = Math.floor((d % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function isClosed(review, now = Date.now()) {
  return !review || review.status === 'closed' || (review.deadline && now >= review.deadline);
}

export const can = {
  upload: (u) => u?.role === 'admin',
  close: (u) => u?.role === 'admin' || u?.role === 'decider',
  resolve: (u) => u?.role === 'admin' || u?.role === 'decider',
  comment: (u) => !!u?.role,
  deleteComment: (u, c) => u?.role === 'admin' || (c && u?.email === c.authorEmail),
};

export function roleLabel(role) { return role ? t(`roles_${role}`) : ''; }

export function defaultDeadline(cfg) {
  const d = new Date();
  d.setDate(d.getDate() + (cfg?.days ?? 2));
  d.setHours(cfg?.hour ?? 17, 0, 0, 0);
  return d;
}

export function toLocalInput(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

// Small modal helper: resolves with the clicked button's value.
export function modal({ title, body, buttons }) {
  return new Promise((resolve) => {
    const el = h(`<div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal">
        ${title ? `<h2 class="modal-title">${esc(title)}</h2>` : ''}
        <div class="modal-body"></div>
        <div class="modal-actions"></div>
      </div></div>`);
    const bodyEl = el.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
    const actions = el.querySelector('.modal-actions');
    (buttons || []).forEach((b) => {
      const btn = h(`<button class="btn ${b.primary ? 'btn-primary' : 'btn-ghost'}" type="button">${esc(b.label)}</button>`);
      btn.addEventListener('click', () => { if (b.keepOpen) { b.onClick?.(btn); return; } el.remove(); resolve(b.value); });
      actions.append(btn);
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { el.remove(); resolve(null); } });
    document.body.append(el);
    (el.querySelector('input, textarea, button.btn-primary') || el.querySelector('button'))?.focus();
  });
}

export async function confirmBox(text) {
  return (await modal({ body: `<p>${esc(text)}</p>`, buttons: [{ label: t('no'), value: false }, { label: t('yes'), value: true, primary: true }] })) === true;
}

export function toast(text) {
  const el = h(`<div class="toast" role="status">${esc(text)}</div>`);
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}
