import { t } from '../i18n.js';
import { config } from '../config.js';
import { esc, fmtDate, fmtLeft, isClosed, can, h, toast, defaultDeadline, toLocalInput } from '../util.js';

export function renderList(root, { store, user }) {
  root.innerHTML = `
    <section class="list-view">
      <div class="list-head">
        <h1 class="page-title">${t('reviews')}</h1>
        ${can.upload(user) ? `<button class="btn btn-primary" id="new-review" type="button">${t('newReview')}</button>` : ''}
      </div>
      <div class="review-rows" id="rows" aria-live="polite"></div>
    </section>`;

  const rows = root.querySelector('#rows');
  const unsub = store.watchReviews((reviews) => {
    if (!reviews.length) { rows.innerHTML = `<p class="empty">${t('noReviews')}</p>`; return; }
    rows.innerHTML = reviews.map((r) => {
      const closed = isClosed(r);
      return `<a class="review-row" href="#/review/${encodeURIComponent(r.id)}">
        <div class="row-main">
          <span class="row-project">${esc(r.project || '')}</span>
          <span class="row-title">${esc(r.title)}</span>
        </div>
        <div class="row-meta">
          <span class="chip">${t('version')} ${r.currentVersion || 1}</span>
          <span class="pill ${closed ? 'pill-closed' : 'pill-open'}">${closed ? t('closed') : t('closesIn', { t: fmtLeft(r.deadline - Date.now()) })}</span>
          <span class="row-date">${fmtDate(r.deadline)}</span>
        </div>
      </a>`;
    }).join('');
  });

  root.querySelector('#new-review')?.addEventListener('click', () => openCreate(store));
  return () => unsub();
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
