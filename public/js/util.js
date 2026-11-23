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
    // Escape is caught on the document, so it still works after the focused element was removed.
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const close = (value) => { document.removeEventListener('keydown', onKey); el.remove(); resolve(value); };
    (buttons || []).forEach((b) => {
      const btn = h(`<button class="btn ${b.primary ? 'btn-primary' : 'btn-ghost'}" type="button">${esc(b.label)}</button>`);
      btn.addEventListener('click', () => { if (b.keepOpen) { b.onClick?.(btn); return; } close(b.value); });
      actions.append(btn);
    });
    document.addEventListener('keydown', onKey);
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

// ── Feedback memory ──────────────────────────────────
// Rules without a status are older ones, saved before approval existed: they count as active.
export const isActiveRule = (r) => r.status !== 'pending';

// Pull rule proposals out of Claude's answer. Takes the list under "RREGULLA TË REJA" (or the skill's
// "Rregulla të propozuara" heading) when present, otherwise every bullet line in the pasted text.
export function parseRuleProposals(text) {
  const lines = String(text || '').split(/\r?\n/);
  const start = lines.findIndex((l) => /rregulla t[ëe] (reja|propozuara)|new rules|proposed rules/i.test(l));
  const body = start >= 0 ? lines.slice(start + 1) : lines;
  const out = [];
  for (const line of body) {
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (!m) {
      if (start >= 0 && out.length && /^\s*(#|\S.*:\s*$)/.test(line)) break; // next heading ends the block
      continue;
    }
    const rule = m[1]
      .replace(/\*\*/g, '')
      .replace(/\s+[—–-]\s+(nga|from)\s+#.*$/i, '') // skill format: "rule" — nga #3 (Dion)
      .replace(/^["“”„']+|["“”„']+$/g, '')
      .trim();
    if (/^(asnjë|asnje|none|…|\.\.\.)$/i.test(rule)) continue;
    if (rule.length > 2 && !out.some((x) => x.toLowerCase() === rule.toLowerCase())) out.push(rule);
  }
  return out;
}
