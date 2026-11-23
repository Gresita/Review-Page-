import { t } from '../i18n.js';
import { config } from '../config.js';
import { esc, fmtTime, fmtDate, fmtLeft, isClosed, can, roleLabel, h, modal, confirmBox, toast } from '../util.js';

const PIN_WINDOW = 0.6; // seconds around the current time in which a comment's pin is shown
const SPEEDS = [1, 0.5, 0.25];

export function renderReview(root, { store, user, reviewId }) {
  const state = {
    review: null, versions: [], comments: [],
    version: null, filter: 'all', draft: null, selectedId: null, loadedSrcFor: null,
  };

  root.innerHTML = `
    <section class="review-view">
      <a class="back-link" href="#/">← ${t('back')}</a>
      <header class="review-head" id="head"></header>
      <div class="review-body">
        <div class="stage-col">
          <div class="stage" id="stage">
            <video id="vid" playsinline preload="metadata"></video>
            <div class="overlay" id="overlay" aria-label="${esc(t('tapHint'))}"></div>
          </div>
          <div class="timeline" id="timeline" role="slider" tabindex="0" aria-label="Timeline" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="tl-track"><div class="tl-fill" id="tl-fill"></div></div>
            <div class="tl-markers" id="tl-markers"></div>
          </div>
          <div class="controls">
            <button class="btn btn-icon" id="c-play" type="button">${t('play')}</button>
            <button class="btn btn-icon" id="c-back" type="button">${t('stepBack')}</button>
            <button class="btn btn-icon" id="c-fwd" type="button">${t('stepFwd')}</button>
            <span class="time" id="c-time">0:00.0 / 0:00.0</span>
            <button class="btn btn-icon" id="c-speed" type="button" title="${esc(t('speed'))}">1×</button>
          </div>
          <p class="hint" id="hint"></p>
          <form class="composer" id="composer" hidden>
            <label for="composer-text" id="composer-label"></label>
            <textarea id="composer-text" rows="3" maxlength="2000" placeholder="${esc(t('writeComment'))}"></textarea>
            <div class="composer-actions">
              <button class="btn btn-ghost" type="button" id="composer-cancel">${t('cancel')}</button>
              <button class="btn btn-primary" type="submit" id="composer-save">${t('save')}</button>
            </div>
          </form>
        </div>
        <aside class="comments-col" aria-label="${esc(t('comments'))}">
          <div class="comments-head">
            <h2>${t('comments')}</h2>
            <div class="seg" role="group">
              <button type="button" class="seg-btn" data-filter="all">${t('all')}</button>
              <button type="button" class="seg-btn" data-filter="open">${t('openOnly')}</button>
            </div>
          </div>
          <p class="comments-count" id="count"></p>
          <ol class="comment-list" id="list"></ol>
        </aside>
      </div>
    </section>`;

  const $ = (s) => root.querySelector(s);
  const vid = $('#vid');
  const stage = $('#stage');
  const overlay = $('#overlay');
  const composer = $('#composer');
  const composerText = $('#composer-text');

  // ── Helpers ──────────────────────────────────────────
  const closed = () => isClosed(state.review);
  const versionComments = () => state.comments.filter((c) => c.version === state.version);
  const visibleComments = () => versionComments().filter((c) => state.filter === 'all' || c.status !== 'resolved');

  function contentRect() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const vw = vid.videoWidth || 16;
    const vh = vid.videoHeight || 9;
    const a = vw / vh;
    if (W / H > a) { const w = H * a; return { left: (W - w) / 2, top: 0, w, h: H }; }
    const hh = W / a;
    return { left: 0, top: (H - hh) / 2, w: W, h: hh };
  }

  // ── Header ───────────────────────────────────────────
  function renderHead() {
    const r = state.review;
    if (!r) { $('#head').innerHTML = ''; return; }
    const isC = closed();
    const opts = state.versions.map((v) => `<option value="${v.n}" ${v.n === state.version ? 'selected' : ''}>${t('version')} ${v.n}</option>`).join('');
    $('#head').innerHTML = `
      <div class="head-text">
        <span class="row-project">${esc(r.project || '')}</span>
        <h1 class="page-title">${esc(r.title)}</h1>
        <div class="head-meta">
          <label class="sr-only" for="ver">${t('version')}</label>
          <select id="ver" class="select">${opts}</select>
          <span class="pill ${isC ? 'pill-closed' : 'pill-open'}">${isC ? t('closed') : t('closesIn', { t: fmtLeft(r.deadline - Date.now()) })}</span>
          <span class="row-date">${t('deadline')}: ${fmtDate(r.deadline)}</span>
        </div>
      </div>
      <div class="head-actions">
        ${can.upload(user) && !isC ? `<button class="btn btn-ghost" id="a-version" type="button">${t('newVersion')}</button>` : ''}
        ${can.close(user) ? (r.status === 'closed'
          ? `<button class="btn btn-ghost" id="a-reopen" type="button">${t('reopen')}</button>`
          : `<button class="btn btn-ghost" id="a-close" type="button">${t('closeReview')}</button>`) : ''}
        ${can.upload(user) ? `<button class="btn btn-ghost" id="a-link" type="button">${t('copyLink')}</button>` : ''}
        ${can.upload(user) ? `<button class="btn btn-ghost" id="a-download" type="button">${t('downloadVideo')}</button>` : ''}
        ${can.close(user) || can.upload(user) ? `<button class="btn btn-primary" id="a-claude" type="button">${t('sendClaude')}</button>` : ''}
        ${can.upload(user) ? `<button class="btn btn-ghost" id="a-delete" type="button">${t('approveDelete')}</button>` : ''}
      </div>`;
    $('#ver').addEventListener('change', (e) => { state.version = Number(e.target.value); state.draft = null; loadVideo(); renderAll(); });
    $('#a-version')?.addEventListener('click', uploadVersion);
    $('#a-close')?.addEventListener('click', async () => {
      if (await confirmBox(t('confirmClose'))) await store.updateReview(r.id, { status: 'closed' });
    });
    $('#a-reopen')?.addEventListener('click', async () => {
      const patch = { status: 'open' };
      if (r.deadline <= Date.now()) {
        const d = new Date(); d.setDate(d.getDate() + (config.defaultDeadline?.days ?? 2)); d.setHours(config.defaultDeadline?.hour ?? 17, 0, 0, 0);
        patch.deadline = d.getTime();
      }
      await store.updateReview(r.id, patch);
    });
    $('#a-claude')?.addEventListener('click', sendToClaude);
    $('#a-download')?.addEventListener('click', async () => {
      const v = state.versions.find((x) => x.n === state.version);
      const url = v ? await store.videoUrl(v) : null;
      if (!url) return;
      const a = document.createElement('a');
      a.href = url; a.download = v.fileName || 'video.mp4'; a.target = '_blank'; a.rel = 'noopener';
      document.body.append(a); a.click(); a.remove();
    });
    $('#a-link')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href); toast(t('linkCopied')); } catch { toast(location.href); }
    });
    $('#a-delete')?.addEventListener('click', async () => {
      if (!(await confirmBox(t('confirmDeleteReview')))) return;
      await store.deleteReview(r.id);
      location.hash = '#/';
    });
  }

  // ── Video ────────────────────────────────────────────
  async function loadVideo() {
    const v = state.versions.find((x) => x.n === state.version);
    if (!v || state.loadedSrcFor === v.id) return;
    state.loadedSrcFor = v.id;
    try {
      const url = await store.videoUrl(v);
      if (!url) throw new Error('missing');
      vid.src = url;
      vid.load();
    } catch {
      toast(t('errVideoLoad'));
    }
  }

  vid.addEventListener('loadedmetadata', () => {
    if (vid.videoWidth && vid.videoHeight) {
      // Size the stage to the video's own shape (4:5, 9:16, 16:9…) so the frame fills it edge to edge.
      const a = vid.videoWidth / vid.videoHeight;
      stage.style.aspectRatio = `${vid.videoWidth} / ${vid.videoHeight}`;
      stage.style.maxWidth = `min(100%, calc(var(--stage-max-h) * ${a.toFixed(4)}))`;
    }
    renderTimeline(); renderPins(); renderTime();
  });
  vid.addEventListener('error', () => { if (vid.src) toast(t('errVideoLoad')); });
  let raf = 0;
  const onTick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { renderPins(); renderTime(); renderProgress(); }); };
  vid.addEventListener('timeupdate', onTick);
  vid.addEventListener('seeked', onTick);
  vid.addEventListener('play', renderPlay);
  vid.addEventListener('pause', renderPlay);
  const ro = new ResizeObserver(() => renderPins());
  ro.observe(stage);

  function renderPlay() { $('#c-play').textContent = vid.paused ? t('play') : t('pause'); }
  function renderTime() { $('#c-time').textContent = `${fmtTime(vid.currentTime)} / ${fmtTime(vid.duration || 0)}`; }
  function renderProgress() {
    const pct = vid.duration ? (vid.currentTime / vid.duration) * 100 : 0;
    $('#tl-fill').style.width = `${pct}%`;
    $('#timeline').setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  function seek(sec, { pause = true } = {}) {
    if (pause) vid.pause();
    vid.currentTime = Math.max(0, Math.min(vid.duration || 0, sec));
  }

  $('#c-play').addEventListener('click', () => { if (vid.paused) vid.play().catch(() => {}); else vid.pause(); });
  $('#c-back').addEventListener('click', () => seek(vid.currentTime - 1));
  $('#c-fwd').addEventListener('click', () => seek(vid.currentTime + 1));
  $('#c-speed').addEventListener('click', (e) => {
    const next = SPEEDS[(SPEEDS.indexOf(vid.playbackRate) + 1) % SPEEDS.length] || 1;
    vid.playbackRate = next;
    e.currentTarget.textContent = `${next}×`;
  });

  // Timeline: click or drag to seek
  const timeline = $('#timeline');
  function seekFromEvent(e) {
    const rect = timeline.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (vid.duration) seek(f * vid.duration);
  }
  timeline.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tl-marker')) return;
    seekFromEvent(e);
    timeline.setPointerCapture(e.pointerId);
    const move = (ev) => seekFromEvent(ev);
    const up = () => { timeline.removeEventListener('pointermove', move); timeline.removeEventListener('pointerup', up); };
    timeline.addEventListener('pointermove', move);
    timeline.addEventListener('pointerup', up);
  });
  timeline.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { seek(vid.currentTime - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { seek(vid.currentTime + 1); e.preventDefault(); }
  });

  function renderTimeline() {
    const d = vid.duration;
    const markers = $('#tl-markers');
    if (!d) { markers.innerHTML = ''; return; }
    markers.innerHTML = versionComments().map((c) => `<button type="button" class="tl-marker ${c.status === 'resolved' ? 'is-resolved' : ''} ${c.id === state.selectedId ? 'is-selected' : ''}" data-id="${esc(c.id)}" style="left:${(c.t / d) * 100}%" title="${esc(fmtTime(c.t))} · ${esc(c.authorName)}"></button>`).join('');
  }
  $('#tl-markers').addEventListener('click', (e) => {
    const m = e.target.closest('.tl-marker');
    if (m) selectComment(m.dataset.id);
  });

  // ── Pins on the frame ────────────────────────────────
  function renderPins() {
    const r = contentRect();
    const now = vid.currentTime;
    const pins = versionComments().filter((c) => Math.abs(c.t - now) <= PIN_WINDOW || c.id === state.selectedId && Math.abs(c.t - now) <= 1.5);
    let html = pins.map((c) => {
      const n = versionComments().indexOf(c) + 1;
      return `<button type="button" class="pin ${c.status === 'resolved' ? 'is-resolved' : ''} ${c.id === state.selectedId ? 'is-selected' : ''}" data-id="${esc(c.id)}" style="left:${r.left + c.x * r.w}px;top:${r.top + c.y * r.h}px" aria-label="${esc(t('commentAt', { time: fmtTime(c.t) }))}">${n}</button>`;
    }).join('');
    if (state.draft) html += `<span class="pin pin-draft" style="left:${r.left + state.draft.x * r.w}px;top:${r.top + state.draft.y * r.h}px">+</span>`;
    overlay.innerHTML = html;
  }

  overlay.addEventListener('click', (e) => {
    const pin = e.target.closest('.pin[data-id]');
    if (pin) { e.stopPropagation(); selectComment(pin.dataset.id); return; }
    if (!state.review || closed() || !can.comment(user)) { if (vid.paused) vid.play().catch(() => {}); else vid.pause(); return; }
    const box = stage.getBoundingClientRect();
    const r = contentRect();
    const x = (e.clientX - box.left - r.left) / r.w;
    const y = (e.clientY - box.top - r.top) / r.h;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    vid.pause();
    state.draft = { t: vid.currentTime, x: +x.toFixed(4), y: +y.toFixed(4) };
    state.selectedId = null;
    openComposer();
    renderPins();
  });

  function openComposer() {
    composer.hidden = false;
    $('#composer-label').textContent = t('commentAt', { time: fmtTime(state.draft.t) });
    composerText.focus();
  }
  function closeComposer() {
    state.draft = null;
    composer.hidden = true;
    composerText.value = '';
    renderPins();
  }
  $('#composer-cancel').addEventListener('click', closeComposer);
  composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = composerText.value.trim();
    if (!text || !state.draft) return;
    const btn = $('#composer-save');
    btn.disabled = true;
    try {
      await store.addComment(state.review.id, { version: state.version, t: +state.draft.t.toFixed(2), x: state.draft.x, y: state.draft.y, text });
      closeComposer();
    } catch (ex) {
      toast(t('errGeneric', { msg: ex.message || ex }));
    } finally { btn.disabled = false; }
  });
  composerText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) composer.requestSubmit();
    if (e.key === 'Escape') closeComposer();
  });

  // Keyboard shortcuts (ignored while typing)
  function onKey(e) {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === ' ') { e.preventDefault(); if (vid.paused) vid.play().catch(() => {}); else vid.pause(); }
    if (e.key === ',') seek(vid.currentTime - 1 / 30);
    if (e.key === '.') seek(vid.currentTime + 1 / 30);
  }
  document.addEventListener('keydown', onKey);

  // ── Comment list ─────────────────────────────────────
  function selectComment(id) {
    const c = state.comments.find((x) => x.id === id);
    if (!c) return;
    state.selectedId = id;
    state.draft = null;
    composer.hidden = true;
    seek(c.t);
    renderList(); renderTimeline(); renderPins();
    root.querySelector(`.comment[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function renderList() {
    const all = versionComments();
    const openN = all.filter((c) => c.status !== 'resolved').length;
    $('#count').textContent = `${t('countAll', { n: all.length })} · ${t('countOpen', { n: openN })}`;
    root.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === state.filter));
    const items = visibleComments();
    const isC = closed();
    $('#list').innerHTML = items.length ? items.map((c) => {
      const n = all.indexOf(c) + 1;
      return `<li class="comment ${c.status === 'resolved' ? 'is-resolved' : ''} ${c.id === state.selectedId ? 'is-selected' : ''}" data-id="${esc(c.id)}">
        <div class="comment-top">
          <button type="button" class="time-chip" data-act="seek">${n} · ${fmtTime(c.t)}</button>
          <span class="author">${esc(c.authorName)}${c.authorRole ? ` <span class="role">${esc(roleLabel(c.authorRole))}</span>` : ''}</span>
          ${c.status === 'resolved' ? `<span class="resolved-tag">${t('resolved')}</span>` : ''}
        </div>
        <p class="comment-text">${esc(c.text)}</p>
        <div class="comment-actions">
          ${can.upload(user) ? `<button type="button" class="link-btn" data-act="rule">${t('saveRule')}</button>` : ''}
          ${can.resolve(user) ? `<button type="button" class="link-btn" data-act="resolve">${c.status === 'resolved' ? t('unresolve') : t('resolve')}</button>` : ''}
          ${can.deleteComment(user, c) && (!isC || user?.role === 'admin') ? `<button type="button" class="link-btn danger" data-act="delete">${t('delete')}</button>` : ''}
        </div>
      </li>`;
    }).join('') : `<li class="empty">${t('noComments')}</li>`;
  }

  $('#list').addEventListener('click', async (e) => {
    const li = e.target.closest('.comment');
    if (!li) return;
    const id = li.dataset.id;
    const act = e.target.closest('[data-act]')?.dataset.act;
    const c = state.comments.find((x) => x.id === id);
    if (act === 'resolve') {
      await store.updateComment(state.review.id, id, { status: c.status === 'resolved' ? 'open' : 'resolved' });
      return;
    }
    if (act === 'rule') {
      await store.addRule(c.text, state.review.title);
      toast(t('ruleSaved'));
      return;
    }
    if (act === 'delete') {
      if (await confirmBox(t('confirmDelete'))) await store.deleteComment(state.review.id, id);
      return;
    }
    selectComment(id);
  });

  root.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.filter; renderList(); }));

  function renderHint() {
    $('#hint').textContent = closed() ? t('closedHint') : (can.comment(user) ? t('tapHint') : '');
    stage.classList.toggle('is-closed', closed());
    if (closed() && !composer.hidden) closeComposer();
  }

  function renderAll() { renderHead(); renderHint(); renderList(); renderTimeline(); renderPins(); }

  // ── Upload new version ───────────────────────────────
  async function uploadVersion() {
    const body = h(`<div>
      <div class="field"><label for="nv-file">${t('videoFile')}</label><input id="nv-file" type="file" accept="video/*"></div>
      <div class="field"><label for="nv-note">${t('note')}</label><input id="nv-note" maxlength="200"></div>
      <p class="form-error" role="alert"></p>
      <div class="progress" hidden><div class="progress-bar"></div><span class="progress-label"></span></div>
    </div>`);
    await modal({
      title: t('newVersion'),
      body,
      buttons: [
        { label: t('cancel'), value: null },
        {
          label: t('save'), primary: true, keepOpen: true,
          onClick: async (btn) => {
            const file = body.querySelector('#nv-file').files[0];
            const err = body.querySelector('.form-error');
            if (!file) { err.textContent = t('errNotVideo'); return; }
            if (!file.type.startsWith('video/')) { err.textContent = t('errNotVideo'); return; }
            if (file.size > config.maxUploadMb * 1024 * 1024) { err.textContent = t('errTooBig', { mb: config.maxUploadMb }); return; }
            btn.disabled = true;
            const prog = body.querySelector('.progress'); prog.hidden = false;
            try {
              const n = await store.addVersion(state.review.id, file, body.querySelector('#nv-note').value.trim(), (p) => {
                const pct = Math.round(p * 100);
                body.querySelector('.progress-bar').style.width = `${pct}%`;
                body.querySelector('.progress-label').textContent = t('uploading', { pct });
              });
              state.version = n;
              btn.closest('.modal-backdrop').remove();
            } catch (ex) {
              btn.disabled = false; prog.hidden = true;
              err.textContent = t('errGeneric', { msg: ex.message || ex });
            }
          },
        },
      ],
    });
  }

  // ── Export (text copied by "Send to Claude"; this window is its fallback when copying fails) ──
  function buildExport() {
    const r = state.review;
    const v = state.versions.find((x) => x.n === state.version);
    const list = versionComments();
    const payload = {
      review: { id: r.id, title: r.title, project: r.project || '', deadline: new Date(r.deadline).toISOString(), status: closed() ? 'closed' : 'open' },
      version: { n: state.version, fileName: v?.fileName || '', note: v?.note || '' },
      decisionRule: 'When comments conflict, the person with role "decider" has the final say.',
      comments: list.map((c, i) => ({
        n: i + 1, time: fmtTime(c.t), seconds: c.t,
        position: { x: Math.round(c.x * 100), y: Math.round(c.y * 100) },
        author: c.authorName, role: c.authorRole || '', status: c.status, text: c.text,
      })),
    };
    const md = [
      `# Review: ${r.title}`,
      `Project: ${r.project || '-'} · Version: v${state.version}${v?.fileName ? ` (${v.fileName})` : ''} · Deadline: ${new Date(r.deadline).toISOString()} · Status: ${payload.review.status}`,
      `Decision rule: ${payload.decisionRule}`,
      '',
      `## Comments on v${state.version}, in video order (x/y = % from top-left of the frame)`,
      ...payload.comments.map((c) => `${c.n}. [${c.time}] (x ${c.position.x}%, y ${c.position.y}%) ${c.author}${c.role ? ` (${c.role})` : ''} [${c.status}]: ${c.text}`),
    ].join('\n');
    return { md, json: JSON.stringify(payload, null, 2) };
  }

  async function openExport() {
    const { md, json } = buildExport();
    const body = h(`<div><p class="muted">${t('exportIntro')}</p><label class="sr-only" for="exp">Export</label><textarea id="exp" class="export-text" rows="12" readonly></textarea></div>`);
    body.querySelector('textarea').value = md;
    await modal({
      title: t('exportAi'),
      body,
      buttons: [
        {
          label: t('downloadJson'), keepOpen: true,
          onClick: () => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
            a.download = `review-${(state.review.project || 'video').replace(/\W+/g, '-')}-v${state.version}.json`;
            document.body.append(a); a.click(); a.remove();
          },
        },
        {
          label: t('copy'), primary: true, keepOpen: true,
          onClick: async (btn) => {
            try { await navigator.clipboard.writeText(md); btn.textContent = t('copied'); } catch { body.querySelector('textarea').select(); }
          },
        },
        { label: t('cancel'), value: null },
      ],
    });
  }

  // ── Send to Claude (/end-brochure-video) ─────────────
  async function sendToClaude() {
    const { md } = buildExport();
    const v = state.versions.find((x) => x.n === state.version);
    const prompt = [
      '/end-brochure-video',
      '',
      `Rikrijo videon "${state.review.title}" (v${state.version}) duke u bazuar në komentet e review-së më poshtë.`,
      'Zbato vetëm komentet e hapura; kur komentet bien ndesh, vendos "decider". Mos ndrysho asgjë tjetër.',
      ...(state.rules && state.rules.length
        ? ['', 'Rregulla të përhershme (zbatoji në çdo video):', ...state.rules.map((r) => '- ' + r.text), '']
        : []),
      v?.url && /^https?:/.test(v.url) ? `Videoja aktuale: ${v.url}` : 'Videoja aktuale: bashkangjite ti në chat.',
      '',
      md,
    ].join('\n');
    try { await navigator.clipboard.writeText(prompt); } catch { await openExport(); return; }
    toast(t('sentClaude'));
    window.open('https://claude.ai/new', '_blank', 'noopener');
  }

  // ── Data subscriptions ───────────────────────────────
  const unsubs = [
    store.watchReview(reviewId, (r) => {
      state.review = r;
      if (!r) { root.querySelector('.review-view').innerHTML = `<a class="back-link" href="#/">← ${t('back')}</a><p class="empty">404</p>`; return; }
      if (state.version == null && r.currentVersion) state.version = r.currentVersion;
      renderAll();
    }),
    store.watchVersions(reviewId, (vs) => {
      state.versions = vs;
      if (state.version == null && vs.length) state.version = vs[vs.length - 1].n;
      if (state.review && vs.length && !vs.some((v) => v.n === state.version)) state.version = vs[vs.length - 1].n;
      loadVideo(); if (state.review) renderHead();
    }),
    can.upload(user) ? store.watchRules((rs) => { state.rules = rs; }) : null,
    store.watchComments(reviewId, (cs) => {
      state.comments = cs;
      if (state.review) { renderList(); renderTimeline(); renderPins(); }
    }),
  ];
  const tick = setInterval(() => { if (state.review) { renderHead(); renderHint(); } }, 30000);

  return () => {
    unsubs.forEach((u) => u && u());
    clearInterval(tick);
    ro.disconnect();
    document.removeEventListener('keydown', onKey);
    vid.pause();
  };
}
