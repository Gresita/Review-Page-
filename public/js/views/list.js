import { t } from '../i18n.js';
import { config } from '../config.js';
import { esc, fmtDate, fmtLeft, isClosed, can, h, toast, defaultDeadline, toLocalInput, modal, confirmBox, isActiveRule, parseRuleProposals } from '../util.js';

export function renderList(root, { store, user }) {
  root.innerHTML = `
    <section class="list-view">
      <div class="list-head">
        <h1 class="page-title">${t('reviews')}</h1>
        ${can.upload(user) ? `<span class="head-actions"><button class="btn btn-ghost" id="open-rules" type="button">${t('rules')}</button><button class="btn btn-primary" id="new-review" type="button">${t('newReview')}</button></span>` : ''}
      </div>
      <div class="review-rows" id="rows" aria-live="polite"></div>
    </section>`;

  const rows = root.querySelector('#rows');
  const showMenu = can.upload(user); // only admins can delete a review
  const unsub = store.watchReviews((reviews) => {
    if (!reviews.length) { rows.innerHTML = `<p class="empty">${t('noReviews')}</p>`; return; }
    rows.innerHTML = reviews.map((r) => {
      const closed = isClosed(r);
      const id = esc(r.id);
      return `<div class="review-item">
        <a class="review-row" href="#/review/${encodeURIComponent(r.id)}">
          <div class="row-main">
            <span class="row-project">${esc(r.project || '')}</span>
            <span class="row-title">${esc(r.title)}</span>
          </div>
          <div class="row-meta">
            <span class="chip">${t('version')} ${r.currentVersion || 1}</span>
            <span class="pill ${closed ? 'pill-closed' : 'pill-open'}">${closed ? t('closed') : t('closesIn', { t: fmtLeft(r.deadline - Date.now()) })}</span>
            <span class="row-date">${fmtDate(r.deadline)}</span>
          </div>
        </a>
        ${showMenu ? `<div class="row-menu">
          <button class="row-menu-btn" type="button" data-menu="${id}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('moreActions', { title: r.title }))}">⋮</button>
          <div class="row-menu-list" role="menu" hidden>
            <button type="button" role="menuitem" class="danger" data-delete="${id}">${t('deleteReview')}</button>
          </div>
        </div>` : ''}
      </div>`;
    }).join('');
  });

  // Three-dot menu per row (event delegation, since rows re-render on every change)
  const closeMenus = (except) => {
    for (const b of rows.querySelectorAll('.row-menu-btn[aria-expanded="true"]')) {
      if (b === except) continue;
      b.setAttribute('aria-expanded', 'false');
      b.nextElementSibling.hidden = true;
    }
  };
  rows.addEventListener('click', async (e) => {
    const btn = e.target.closest('.row-menu-btn');
    if (btn) {
      closeMenus(btn);
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      btn.nextElementSibling.hidden = !open;
      if (open) btn.nextElementSibling.querySelector('[role=menuitem]')?.focus();
      return;
    }
    const del = e.target.closest('[data-delete]');
    if (del) {
      closeMenus();
      if (!(await confirmBox(t('confirmDeleteReview')))) return;
      try {
        await store.deleteReview(del.dataset.delete);
        toast(t('reviewDeleted'));
      } catch (ex) {
        toast(t('errGeneric', { msg: ex.message || ex }));
      }
    }
  });
  const onDocClick = (e) => { if (!e.target.closest?.('.row-menu')) closeMenus(); };
  const onDocKey = (e) => {
    if (e.key !== 'Escape') return;
    const open = rows.querySelector('.row-menu-btn[aria-expanded="true"]');
    if (open) { closeMenus(); open.focus(); }
  };
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKey);

  root.querySelector('#new-review')?.addEventListener('click', () => openCreate(store));
  root.querySelector('#open-rules')?.addEventListener('click', () => openRules(store));
  // Show how many proposed rules wait for approval on the Rules button.
  const rulesBtn = root.querySelector('#open-rules');
  const unsubRules = rulesBtn
    ? store.watchRules((rs) => {
      const n = rs.filter((r) => !isActiveRule(r)).length;
      rulesBtn.textContent = n ? `${t('rules')} · ${t('rulesPendingCount', { n })}` : t('rules');
    })
    : null;
  return () => {
    unsub();
    unsubRules?.();
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onDocKey);
  };
}

// Feedback memory: rules Claude proposed wait here for approval; approved rules go with every request to Claude.
async function openRules(store) {
  let current = [];
  const body = h(`<div class="rules">
    <p class="muted">${t('rulesIntro')}</p>
    <section class="rules-pending" hidden>
      <h3 class="rules-h">${t('rulesPending')}</h3>
      <ul class="rule-list" data-list="pending"></ul>
    </section>
    <section>
      <h3 class="rules-h">${t('rulesActive')}</h3>
      <ul class="rule-list" data-list="active"></ul>
    </section>
    <form class="rule-add" data-form="add">
      <input type="text" maxlength="300" placeholder="${esc(t('rulePlaceholder'))}" aria-label="${esc(t('ruleAdd'))}">
      <button class="btn btn-ghost btn-sm" type="submit">${t('ruleAdd')}</button>
    </form>
    <details class="rule-paste">
      <summary>${t('rulesPasteTitle')}</summary>
      <p class="muted">${t('rulesPasteIntro')}</p>
      <textarea rows="5" aria-label="${esc(t('rulesPasteTitle'))}"></textarea>
      <button class="btn btn-ghost btn-sm" type="button" data-act="paste">${t('rulesPasteBtn')}</button>
    </details>
  </div>`);
  const pendingSec = body.querySelector('.rules-pending');
  const pendingUl = body.querySelector('[data-list="pending"]');
  const activeUl = body.querySelector('[data-list="active"]');
  const src = (r) => (r.source ? ` <span class="muted">· ${esc(r.source)}</span>` : '');

  const unsub = store.watchRules((rules) => {
    current = rules;
    const pending = rules.filter((r) => !isActiveRule(r));
    const active = rules.filter(isActiveRule);
    pendingSec.hidden = !pending.length;
    pendingUl.innerHTML = pending.map((r) => `<li class="rule-item is-pending" data-id="${esc(r.id)}">
        <input type="text" maxlength="300" value="${esc(r.text)}" aria-label="${esc(t('ruleEdit'))}">
        <span class="rule-btns">
          <button type="button" class="btn btn-primary btn-sm" data-act="approve">${t('ruleApprove')}</button>
          <button type="button" class="link-btn danger" data-act="reject">${t('ruleReject')}</button>
        </span>
      </li>`).join('');
    activeUl.innerHTML = active.length
      ? active.map((r) => `<li class="rule-item" data-id="${esc(r.id)}"><span>${esc(r.text)}${src(r)}</span><button type="button" class="link-btn danger" data-act="delete">${t('delete')}</button></li>`).join('')
      : `<li class="empty">${t('noRules')}</li>`;
  });

  body.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'paste') {
      const ta = body.querySelector('.rule-paste textarea');
      const known = new Set(current.map((r) => r.text.trim().toLowerCase()));
      const found = parseRuleProposals(ta.value).filter((x) => !known.has(x.toLowerCase()));
      if (!found.length) { toast(t('rulesPasteNone')); return; }
      for (const text of found) await store.addRule(text, 'Claude', 'pending');
      ta.value = '';
      body.querySelector('.rule-paste').open = false;
      toast(t('rulesPasteAdded', { n: found.length }));
      return;
    }
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    if (act === 'approve') {
      const text = li.querySelector('input').value.trim();
      if (text) await store.updateRule(id, { text, status: 'active' });
    } else if (act === 'reject' || act === 'delete') {
      await store.deleteRule(id);
    }
  });

  body.querySelector('[data-form="add"]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    await store.addRule(text, '');
    input.value = '';
    toast(t('ruleSaved'));
  });

  await modal({
    title: t('rulesTitle'),
    body,
    buttons: [
      {
        label: t('copyRules'), keepOpen: true,
        onClick: async () => {
          const text = [t('rulesHeader'), ...current.filter(isActiveRule).map((r) => '- ' + r.text)].join(String.fromCharCode(10));
          try { await navigator.clipboard.writeText(text); toast(t('rulesCopied')); } catch { toast(text); }
        },
      },
      { label: t('closeModal'), value: null, primary: true },
    ],
  });
  unsub();
}

function openCreate(store) {
  const el = h(`<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nr-title">
    <form class="modal" id="nr-form" novalidate>
      <h2 class="modal-title" id="nr-title">${t('newReview')}</h2>
      <div class="field"><label for="nr-name">${t('title')}</label><input id="nr-name" required maxlength="140" placeholder="Magnolia — brochure 60s"></div>
      <div class="field"><label for="nr-project">${t('project')}</label><input id="nr-project" maxlength="80" placeholder="Magnolia"></div>
      <div class="field"><label for="nr-deadline">${t('deadline')}</label><input id="nr-deadline" type="datetime-local" required value="${toLocalInput(defaultDeadline(config.defaultDeadline))}"></div>
      <div class="field"><label for="nr-file">${t('videoFile')}</label><input id="nr-file" type="file" accept="video/*" required></div>
      <p class="form-error" id="nr-error" role="alert"></p>
      <div class="progress" hidden><div class="progress-bar"></div><span class="progress-label"></span></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" id="nr-cancel">${t('cancel')}</button>
        <button class="btn btn-primary" type="submit" id="nr-submit">${t('create')}</button>
      </div>
    </form></div>`);
  document.body.append(el);
  el.querySelector('#nr-name').focus();
  const close = () => el.remove();
  el.querySelector('#nr-cancel').addEventListener('click', close);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  el.querySelector('#nr-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = el.querySelector('#nr-name').value.trim();
    const project = el.querySelector('#nr-project').value.trim();
    const deadlineStr = el.querySelector('#nr-deadline').value;
    const file = el.querySelector('#nr-file').files[0];
    const err = el.querySelector('#nr-error');
    err.textContent = '';
    if (!title || !deadlineStr || !file) { err.textContent = t('errFill'); return; }
    if (!file.type.startsWith('video/')) { err.textContent = t('errNotVideo'); return; }
    if (file.size > config.maxUploadMb * 1024 * 1024) { err.textContent = t('errTooBig', { mb: config.maxUploadMb }); return; }
    const progress = el.querySelector('.progress');
    const bar = el.querySelector('.progress-bar');
    const label = el.querySelector('.progress-label');
    progress.hidden = false;
    el.querySelector('#nr-submit').disabled = true;
    try {
      const id = await store.createReview({ title, project, deadline: new Date(deadlineStr).getTime() }, file, (p) => {
        const pct = Math.round(p * 100);
        bar.style.width = `${pct}%`;
        label.textContent = t('uploading', { pct });
      });
      close();
      location.hash = `#/review/${encodeURIComponent(id)}`;
    } catch (ex) {
      el.querySelector('#nr-submit').disabled = false;
      progress.hidden = true;
      err.textContent = t('errGeneric', { msg: ex.message || ex });
      toast(t('errGeneric', { msg: ex.message || ex }));
    }
  });
}
