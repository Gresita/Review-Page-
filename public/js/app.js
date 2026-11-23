import { config } from './config.js';
import { t, toggleLang, getLang } from './i18n.js';
import { loadStore, backend } from './store/index.js';
import { esc, roleLabel, toast } from './util.js';
import { renderList } from './views/list.js';
import { renderReview } from './views/review.js';

const header = document.getElementById('app-header');
const main = document.getElementById('app-main');
let store;
let user = null;
let cleanup = null;
let guestDismissed = false;

function renderHeader() {
  header.innerHTML = `
    <a class="brand" href="#/" aria-label="${esc(t('appName'))}">
      <img src="assets/logo.png" alt="END Properties" class="brand-logo" width="105" height="32">
      <span class="brand-name">${t('appName')}</span>
    </a>
    <div class="header-right">
      ${backend === 'local' ? '<span class="chip chip-demo">DEMO</span>' : ''}
      ${user?.role && !user.anon ? `<span class="who">${esc(user.name)} <span class="role">${esc(roleLabel(user.role))}</span></span>` : ''}
      ${user && !user.anon && backend !== 'local' ? `<a class="btn btn-ghost btn-sm" href="match/">${t('matchLink')}</a>` : ''}
      <button class="btn btn-ghost btn-sm" id="lang" type="button">${t('lang')}</button>
      ${user ? `<button class="btn btn-ghost btn-sm" id="signout" type="button">${t('signOut')}</button>` : ''}
    </div>`;
  header.querySelector('#lang').addEventListener('click', () => { toggleLang(); route(); });
  header.querySelector('#signout')?.addEventListener('click', () => store.signOut());
}

function renderSignIn() {
  if (backend === 'local') {
    main.innerHTML = `<section class="signin">
      <h1 class="page-title">${t('signInTitle')}</h1>
      <p class="muted">${t('demoHint')}</p>
      <div class="demo-users">${store.demoMembers().map((m) => `<button class="btn btn-ghost demo-user" type="button" data-email="${esc(m.email)}">${esc(m.name)} <span class="role">${esc(roleLabel(m.role))}</span></button>`).join('')}</div>
    </section>`;
    main.querySelectorAll('.demo-user').forEach((b) => b.addEventListener('click', () => store.signInWithEmail(b.dataset.email)));
    return;
  }
  main.innerHTML = `<section class="signin">
    <h1 class="page-title">${t('signInTitle')}</h1>
    ${config.signIn.google ? `<button class="btn btn-primary" id="g" type="button">${t('signInGoogle')}</button>` : ''}
    ${config.signIn.emailPassword ? `<form id="ep" class="signin-form" novalidate>
      <div class="field"><label for="ep-email">${t('email')}</label><input id="ep-email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="ep-pass">${t('password')}</label><input id="ep-pass" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-ghost" type="submit">${t('signIn')}</button>
      <p class="form-error" role="alert"></p>
    </form>` : ''}
  </section>`;
  main.querySelector('#g')?.addEventListener('click', () => store.signInWithGoogle().catch((e) => toast(t('errGeneric', { msg: e.message }))));
  main.querySelector('#ep')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await store.signInWithEmail(main.querySelector('#ep-email').value.trim(), main.querySelector('#ep-pass').value); } catch (ex) {
      main.querySelector('.form-error').textContent = t('errGeneric', { msg: ex.code || ex.message });
    }
  });
}

// Guests must give a name so others know who commented. `signedIn` = a guest session already exists but has no name.
function renderGuest(signedIn = false) {
  main.innerHTML = `<section class="signin">
    <h1 class="page-title">${t('guestTitle')}</h1>
    <p class="muted">${t('guestIntro')}</p>
    <form id="guest" class="signin-form" novalidate>
      <div class="field"><label for="guest-name">${t('guestName')}</label><input id="guest-name" maxlength="60" autocomplete="name" required></div>
      <button class="btn btn-primary" type="submit">${t('guestOpen')}</button>
      <p class="form-error" role="alert"></p>
    </form>
    ${signedIn ? '' : `<p><button class="link-btn" id="staff" type="button">${t('staffSignIn')}</button></p>`}
  </section>`;
  const input = main.querySelector('#guest-name');
  input.focus();
  main.querySelector('#guest').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    const err = main.querySelector('.form-error');
    if (!name) { err.textContent = t('errNameRequired'); input.focus(); return; }
    try {
      if (signedIn) { user = await store.setGuestName(name); route(); } else await store.signInGuest(name);
    } catch (ex) {
      err.textContent = t('errGeneric', { msg: ex.code || ex.message });
    }
  });
  main.querySelector('#staff')?.addEventListener('click', () => { guestDismissed = true; route(); });
}

// Public root: no login form. Guests arrive through a review link; the team uses the small link below.
function renderLanding() {
  main.innerHTML = `<section class="signin">
    <p class="muted">${t('guestNeedLink')}</p>
    <p><button class="link-btn" id="staff" type="button">${t('staffSignIn')}</button></p>
  </section>`;
  main.querySelector('#staff').addEventListener('click', () => { guestDismissed = true; route(); });
}

function route() {
  renderHeader();
  if (cleanup) { cleanup(); cleanup = null; }
  const m = location.hash.match(/^#\/review\/(.+)$/);
  if (!user) {
    if (m && !guestDismissed) renderGuest();
    else if (backend !== 'local' && !guestDismissed) renderLanding();
    else renderSignIn();
    return;
  }
  if (user.anon && !m) { main.innerHTML = `<section class="signin"><p>${t('guestNeedLink')}</p></section>`; return; }
  if (user.anon && !user.named) { renderGuest(true); return; }
  if (!user.role) { main.innerHTML = `<section class="signin"><p>${t('noAccess')}</p><p class="muted">${esc(user.email)}</p></section>`; return; }
  cleanup = m
    ? renderReview(main, { store, user, reviewId: decodeURIComponent(m[1]) })
    : renderList(main, { store, user });
}

async function start() {
  document.documentElement.lang = getLang();
  try {
    store = await loadStore();
  } catch (e) {
    main.innerHTML = `<p class="empty">${esc(t('errGeneric', { msg: e.message }))}</p>`;
    return;
  }
  store.onAuth((u) => { user = u; route(); });
  window.addEventListener('hashchange', route);
}

start();
