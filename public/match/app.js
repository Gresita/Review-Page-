import {
  FIELDS, FIELD_NAMES, QUESTIONS, emptyClient, normalizeValue,
  isAnswered, CURRENCIES, fromAED,
} from './shared/fields.js';
import { initAuth, onUser, signInWithGoogle, signInWithEmail, authFetch } from './auth.js';
// No sign-out here: Match shares the Review Page sign-in, so signing out happens on the Review Page only.

const T = {
  sq: {
    title: 'Përputhja e projekteve',
    backToReview: '← Review Page',
    formTitle: 'Kërkesat e klientit',
    search: 'Kërko projekte',
    clear: 'Pastro',
    questionsTitle: 'Pyetjet për klientin',
    keyQuestions: 'Pyetjet kryesore (filtrat)',
    supportQuestions: 'Pyetjet ndihmëse (renditja)',
    stillToAsk: 'Mbetet për t’u pyetur:',
    allAsked: 'Të gjitha pyetjet kryesore janë përgjigjur.',
    searching: 'Duke kërkuar…',
    noResults: 'Asnjë projekt nuk i plotëson kërkesat.',
    found: (n, t) => `${n} nga ${t} projekte i plotësojnë kërkesat.`,
    hidden: 'Të fshehura:',
    showingTop: (n) => `Shfaqen ${n} më të mirat.`,
    closeTitle: 'Më të afërtat (nuk i plotësojnë të gjitha kushtet)',
    differs: 'Ndryshon në',
    overBy: (n) => `mbi buxhet me ${n}%`,
    showIn: 'Çmimet në',
    signInTitle: 'Hyr për të vazhduar',
    signInGoogle: 'Hyr me Google',
    email: 'Email', password: 'Fjalëkalimi', signIn: 'Hyr', signOut: 'Dil',
    signInFailed: 'Hyrja dështoi. Kontrollo email-in dhe fjalëkalimin.',
    agentOnly: 'vetëm për agjentin, nuk përdoret në kërkim',
    from: 'nga', yield: 'kthimi nga qiraja', handover: 'dorëzimi', gv: 'Golden Visa',
    gvUnknown: 'Golden Visa: e panjohur', minDp: 'paradhënia min.',
    reasons: {
      over_budget: 'mbi buxhet', property_type: 'lloji i pronës', bedrooms: 'dhomat e gjumit',
      offplan_or_ready: 'gati / off-plan', payment_plan_years: 'vitet e pagesës pas dorëzimit',
      down_payment: 'paradhënia nuk mjafton', area: 'zona', developer: 'developeri', handover: 'kur i do çelësat',
    },
    labels: {
      budget: 'Buxheti', currency: 'Monedha', goal: 'Qëllimi', propertyType: 'Lloji i pronës',
      bedrooms: 'Dhoma gjumi', offplanOrReady: 'Gati apo off-plan', paymentMethod: 'Mënyra e pagesës',
      downPayment: 'Paradhënia në dispozicion', paymentPlanYears: 'Vite pagese pas dorëzimit',
      priority: 'Prioriteti', area: 'Zona', nearSea: 'Afër detit', handover: 'Kur i do çelësat',
      mustHaves: 'Duhet të ketë patjetër', goldenVisa: 'Interes për Golden Visa', developer: 'Developeri i preferuar',
      decisionTimeline: 'Kur do të vendosë',
    },
    options: {
      '': '—',
      rent_out: 'Me qira', resell: 'Rishitje', live_in: 'Për të jetuar',
      apartment: 'Apartament', villa: 'Vilë', townhouse: 'Townhouse', any: 'Çdo lloj',
      offplan: 'Off-plan', ready: 'E gatshme',
      cash: 'Cash', payment_plan: 'Plan pagese', mortgage: 'Kredi hipotekore',
      rental_income: 'Të ardhurat nga qiraja', capital_growth: 'Rritja e vlerës', lifestyle: 'Stili i jetesës',
      true: 'Po', false: 'Jo',
    },
    studio: 'Studio',
    noPostHandover: 'Jo, pa pagesa pas dorëzimit',
    years: (n) => `${n} ${n === 1 ? 'vit' : 'vite'}`,
    readyNow: 'Tani (e gatshme)',
    byYear: (y) => `Deri në fund të ${y}`,
    orLater: (y) => `${y} ose më vonë`,
    loading: 'Duke ngarkuar listën…',
    must: {
      beach: 'Plazh', 'sea view': 'Pamje nga deti', golf: 'Golf', metro: 'Metro', schools: 'Shkolla',
      pool: 'Pishinë', gym: 'Palestër', park: 'Park', mall: 'Qendër tregtare', 'kids area': 'Kënd lojërash',
      pets: 'Lejohen kafshët',
    },
    timeline: {
      this_week: 'Këtë javë', this_month: 'Këtë muaj', '1_3_months': '1–3 muaj', '3_6_months': '3–6 muaj',
      later: 'Më vonë / pa afat',
    },
  },
  en: {
    title: 'Project match',
    backToReview: '← Review Page',
    formTitle: 'Client requirements',
    search: 'Search projects',
    clear: 'Clear',
    questionsTitle: 'Questions for the client',
    keyQuestions: 'Key questions (filters)',
    supportQuestions: 'Supporting questions (ranking)',
    stillToAsk: 'Still to ask:',
    allAsked: 'All key questions are answered.',
    searching: 'Searching…',
    noResults: 'No project meets every requirement.',
    found: (n, t) => `${n} of ${t} projects meet the requirements.`,
    hidden: 'Hidden:',
    showingTop: (n) => `Showing the best ${n}.`,
    closeTitle: 'Closest matches (not every requirement met)',
    differs: 'Differs on',
    overBy: (n) => `over budget by ${n}%`,
    showIn: 'Prices in',
    signInTitle: 'Sign in to continue',
    signInGoogle: 'Sign in with Google',
    email: 'Email', password: 'Password', signIn: 'Sign in', signOut: 'Sign out',
    signInFailed: 'Sign-in failed. Check the email and password.',
    agentOnly: 'agent only, not used in search',
    from: 'from', yield: 'rental yield', handover: 'handover', gv: 'Golden Visa',
    gvUnknown: 'Golden Visa: unknown', minDp: 'min. down payment',
    reasons: {
      over_budget: 'over budget', property_type: 'property type', bedrooms: 'bedrooms',
      offplan_or_ready: 'ready / off-plan', payment_plan_years: 'post-handover years',
      down_payment: 'down payment too low', area: 'area', developer: 'developer', handover: 'keys date',
    },
    labels: {
      budget: 'Budget', currency: 'Currency', goal: 'Goal', propertyType: 'Property type',
      bedrooms: 'Bedrooms', offplanOrReady: 'Ready or off-plan', paymentMethod: 'Payment method',
      downPayment: 'Down payment available', paymentPlanYears: 'Years of payments after handover',
      priority: 'Priority', area: 'Area', nearSea: 'Near the sea', handover: 'Wants keys by',
      mustHaves: 'Must-haves', goldenVisa: 'Golden Visa interest', developer: 'Preferred developer',
      decisionTimeline: 'Decision timeline',
    },
    options: {
      '': '—',
      rent_out: 'Rent out', resell: 'Resell', live_in: 'Live in',
      apartment: 'Apartment', villa: 'Villa', townhouse: 'Townhouse', any: 'Any',
      offplan: 'Off-plan', ready: 'Ready',
      cash: 'Cash', payment_plan: 'Payment plan', mortgage: 'Mortgage',
      rental_income: 'Rental income', capital_growth: 'Capital growth', lifestyle: 'Lifestyle',
      true: 'Yes', false: 'No',
    },
    studio: 'Studio',
    noPostHandover: 'No post-handover payments',
    years: (n) => `${n} ${n === 1 ? 'year' : 'years'}`,
    readyNow: 'Now (ready)',
    byYear: (y) => `By end of ${y}`,
    orLater: (y) => `${y} or later`,
    loading: 'Loading list…',
    must: {
      beach: 'Beach', 'sea view': 'Sea view', golf: 'Golf', metro: 'Metro', schools: 'Schools',
      pool: 'Pool', gym: 'Gym', park: 'Park', mall: 'Mall', 'kids area': 'Kids area', pets: 'Pet friendly',
    },
    timeline: {
      this_week: 'This week', this_month: 'This month', '1_3_months': '1–3 months', '3_6_months': '3–6 months',
      later: 'Later / no deadline',
    },
  },
};

// Match is shown in English only. The Albanian strings stay above in case it is switched back.
const lang = 'en';
const t = () => T[lang];

let client = emptyClient();
let lastResults = null;

const $ = (sel) => document.querySelector(sel);
const fieldsEl = $('#fields');

// ---------- form ----------
// Text shown for one dropdown/checkbox value of a field, in the current language.
function optLabel(name, v) {
  if (v === '' || v === null || v === undefined) return '—';
  if (name === 'currency' || FIELDS[name].choices === 'live') return v;
  if (name === 'bedrooms') return +v === 0 ? t().studio : v;
  if (name === 'paymentPlanYears') return +v === 0 ? t().noPostHandover : t().years(+v);
  if (name === 'handover') {
    if (v === 'ready') return t().readyNow;
    if (v.endsWith('_plus')) return t().orLater(v.slice(0, -5));
    return t().byYear(v);
  }
  if (name === 'decisionTimeline') return t().timeline[v] ?? v;
  if (name === 'mustHaves') return t().must[v] ?? v;
  return t().options[v] ?? v;
}

function controlFor(name) {
  const def = FIELDS[name];
  let el;
  if (def.type === 'list' && def.values) {
    // Checkbox group: pick as many as apply.
    el = document.createElement('div');
    el.className = 'checks';
    el.tabIndex = -1;
    for (const v of def.values) {
      const lab = document.createElement('label');
      lab.className = 'check-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = v;
      cb.addEventListener('change', () => {
        client[name] = [...el.querySelectorAll('input:checked')].map((x) => x.value);
        refreshProgress();
      });
      lab.append(cb, document.createElement('span'));
      el.append(lab);
    }
    el.id = 'f-' + name;
    return el;
  }
  if (def.type === 'enum' || def.type === 'boolean' || def.choices) {
    el = document.createElement('select');
    const values = def.type === 'boolean' ? ['true', 'false']
      : def.type === 'enum' ? def.values
      : Array.isArray(def.choices) ? def.choices.map(String) : [];
    for (const v of ['', ...values]) el.append(new Option('', v));
  } else {
    el = document.createElement('input');
    el.type = def.type === 'number' ? 'number' : 'text';
    if (def.type === 'number') { el.min = '0'; el.step = 'any'; el.inputMode = 'decimal'; }
  }
  el.id = 'f-' + name;
  el.name = name;
  el.addEventListener('input', () => {
    const raw = el.value;
    client[name] = normalizeValue(name, def.type === 'boolean' ? (raw === '' ? null : raw === 'true') : raw);
    refreshProgress();
  });
  return el;
}

function buildForm() {
  for (const name of FIELD_NAMES) {
    const wrap = document.createElement('div');
    wrap.className = 'field' + (FIELDS[name].agentOnly ? ' agent-only' : '');
    wrap.dataset.field = name;
    const label = document.createElement('label');
    label.htmlFor = 'f-' + name;
    wrap.append(label, controlFor(name));
    if (FIELDS[name].agentOnly) {
      const note = document.createElement('small');
      note.className = 'muted note';
      wrap.append(note);
    }
    fieldsEl.append(wrap);
  }
}

function writeForm() {
  for (const name of FIELD_NAMES) {
    const el = document.getElementById('f-' + name);
    const v = client[name];
    if (el.classList.contains('checks')) {
      for (const cb of el.querySelectorAll('input')) cb.checked = (v || []).includes(cb.value);
      continue;
    }
    const s = v === null ? '' : String(v);
    // A saved area/developer that is no longer in the live list still shows up.
    if (el.tagName === 'SELECT' && s && ![...el.options].some((o) => o.value === s)) el.append(new Option(optLabel(name, s), s));
    el.value = s;
  }
  refreshProgress();
}

// Area and developer lists come from the live projects.
async function loadLiveOptions() {
  const live = FIELD_NAMES.filter((n) => FIELDS[n].choices === 'live');
  for (const n of live) document.getElementById('f-' + n).options[0].textContent = t().loading;
  try {
    const res = await authFetch('/api/options');
    if (!res.ok) throw new Error();
    const data = await res.json();
    const lists = { area: data.areas, developer: data.developers };
    for (const n of live) {
      const el = document.getElementById('f-' + n);
      const current = el.value;
      el.replaceChildren(new Option('—', ''), ...(lists[n] || []).map((v) => new Option(v, v)));
      if (current && ![...el.options].some((o) => o.value === current)) el.append(new Option(current, current));
      el.value = current;
    }
  } catch {
    for (const n of live) document.getElementById('f-' + n).options[0].textContent = '—';
  }
}

// ---------- questions ----------
function questionItem(q) {
  const li = document.createElement('li');
  li.dataset.q = q.n;
  li.value = q.n;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'qbtn';
  btn.addEventListener('click', () => focusField(q.fields[0]));
  li.append(btn);
  return li;
}

function buildQuestions() {
  for (const q of QUESTIONS) (q.key ? $('#keyList') : $('#supportList')).append(questionItem(q));
}

function focusField(name) {
  const el = document.getElementById('f-' + name);
  el.focus();
  el.closest('.field').classList.add('flash');
  setTimeout(() => el.closest('.field').classList.remove('flash'), 1200);
}

function refreshProgress() {
  for (const q of QUESTIONS) {
    const li = document.querySelector(`li[data-q="${q.n}"]`);
    const done = isAnswered(q, client);
    li.classList.toggle('done', done);
    li.querySelector('.qbtn').innerHTML =
      `<span class="check" aria-hidden="true">${done ? "✓" : ""}</span><span class="qnum">${q.n}.</span><span class="qtext">${escapeHtml(q[lang])}</span>` +
      `<span class="sr-only">${done ? ' (✓)' : ''}</span>`;
  }
}

// ---------- language ----------
function applyLang() {
  document.documentElement.lang = lang;
  document.title = t().title;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t()[el.dataset.i18n];
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t()[el.dataset.i18nPlaceholder];
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t()[el.dataset.i18nTitle];
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  for (const name of FIELD_NAMES) {
    const wrap = fieldsEl.querySelector(`[data-field="${name}"]`);
    let label = t().labels[name];
    if (name === 'downPayment' && client.currency) label += ` (${client.currency})`;
    wrap.querySelector('label').textContent = label;
    const note = wrap.querySelector('.note');
    if (note) note.textContent = t().agentOnly;
    const sel = wrap.querySelector('select');
    if (sel && FIELDS[name].choices !== 'live') for (const o of sel.options) o.textContent = optLabel(name, o.value);
    for (const lab of wrap.querySelectorAll('.check-item')) {
      lab.querySelector('span').textContent = optLabel(name, lab.querySelector('input').value);
    }
  }
  refreshProgress();
  if (lastResults) renderResults(lastResults);
}

// ---------- match ----------
async function onSearch(e) {
  e.preventDefault();
  const out = $('#results');
  out.innerHTML = `<p class="muted">${t().searching}</p>`;
  try {
    const res = await authFetch('/api/match', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client, lang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    lastResults = data;
    renderResults(data);
  } catch (err) {
    out.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

const fmt = (n) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'sq-AL', { maximumFractionDigits: 0 }).format(n);

// Display currency for result prices. Starts as the client's currency; the agent can switch it.
let showCurrency = null;
const priceText = (aed) => {
  const cur = showCurrency || client.currency || 'AED';
  return aed == null ? '—' : `${cur} ${fmt(fromAED(aed, cur))}`;
};

function resultCard(p) {
  const gv = p.goldenVisaEligible === true ? `<span class="badge ok">${t().gv}</span>`
    : p.goldenVisaEligible === null ? `<span class="badge">${t().gvUnknown}</span>` : '';
  const meta = [
    `${t().from} ${priceText(p.priceFromAED)}`,
    p.rentalYield != null ? `${t().yield} ${p.rentalYield}%` : null,
    `${t().handover} ${escapeHtml(p.handover || '—')}`,
    p.minDownPaymentPct != null ? `${t().minDp} ${p.minDownPaymentPct}%` : null,
  ].filter(Boolean).join(' · ');
  const differs = p.missed?.length
    ? `<p class="differs">${t().differs}: ${p.missed.map((r) => r === 'over_budget' && p.overBudgetPct ? t().overBy(p.overBudgetPct) : escapeHtml(t().reasons[r] || r)).join(', ')}</p>`
    : '';
  const photo = p.photo
    ? `<img class="result-photo" src="${escapeHtml(p.photo)}" alt="${escapeHtml(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'result-photo empty'}))">`
    : '<div class="result-photo empty" aria-hidden="true"></div>';
  return `<li class="result card${p.missed ? ' is-close' : ''}">
    ${photo}
    <div class="result-body">
    <div class="result-head">
      <h3>${escapeHtml(p.name)}</h3>
      ${p.score != null ? `<span class="score">${p.score}</span>` : ''}
    </div>
    <p class="muted">${escapeHtml(p.developer || '')} · ${escapeHtml(p.area || '')} · ${p.propertyTypes.map((x) => t().options[x] || x).join(', ')}</p>
    <p>${meta}</p>
    ${differs}
    ${p.reason ? `<p class="reason">${escapeHtml(p.reason)}</p>` : ''}
    <p class="tags">${gv}${p.tags.map((x) => `<span class="badge">${escapeHtml(x)}</span>`).join('')}</p>
    </div>
  </li>`;
}

function renderResults(data) {
  const out = $('#results');
  const parts = [];
  const cur = showCurrency || client.currency || 'AED';
  parts.push(`<div class="results-head"><p><strong>${t().found(data.matched, data.total)}</strong></p>
    <label class="show-in">${t().showIn}
      <select id="showCurrency">${CURRENCIES.map((c) => `<option${c === cur ? ' selected' : ''}>${c}</option>`).join('')}</select>
    </label></div>`);
  const hidden = Object.entries(data.excluded);
  if (hidden.length) {
    parts.push(`<p class="muted">${t().hidden} ${hidden.map(([r, n]) => `${escapeHtml(t().reasons[r] || r)} (${n})`).join(', ')}</p>`);
  }
  if (data.matched > data.results.length) parts.push(`<p class="muted">${t().showingTop(data.results.length)}</p>`);
  if (!data.results.length) parts.push(`<p>${t().noResults}</p>`);
  parts.push('<ol class="results">', ...data.results.map((p) => resultCard(p)), '</ol>');
  if (data.close?.length) {
    parts.push(`<h3 class="h2 close-title">${t().closeTitle}</h3>`, '<ol class="results close">', ...data.close.map((p) => resultCard(p)), '</ol>');
  }
  out.innerHTML = parts.join('');
  $('#showCurrency').addEventListener('change', (e) => {
    showCurrency = e.target.value;
    renderResults(data);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- init ----------
buildForm();
buildQuestions();
document.getElementById('f-currency').addEventListener('change', applyLang);
$('#clientForm').addEventListener('submit', onSearch);
$('#clearBtn').addEventListener('click', () => {
  client = emptyClient();
  lastResults = null;
  $('#results').innerHTML = '';
  writeForm();
  applyLang();
});
applyLang();
writeForm();

// ---------- sign-in ----------
let liveLoaded = false;
function showApp(signedIn, email) {
  if (signedIn && !liveLoaded) { liveLoaded = true; loadLiveOptions(); }
  $('#signin').hidden = signedIn;
  $('.layout').hidden = !signedIn;
  $('#userBox').hidden = !email;
  $('#userEmail').textContent = email || '';
}

$('#googleBtn').addEventListener('click', () => signInWithGoogle().catch(() => {
  $('#signinError').textContent = t().signInFailed;
}));
$('#emailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await signInWithEmail($('#email').value.trim(), $('#password').value);
  } catch {
    $('#signinError').textContent = t().signInFailed;
  }
});

showApp(false);
initAuth().then((required) => {
  if (!required) return showApp(true, null);
  onUser((user) => showApp(!!user, user?.email));
}).catch(() => {
  $('#signinError').textContent = t().signInFailed;
});

