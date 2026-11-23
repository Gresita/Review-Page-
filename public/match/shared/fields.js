// GENERATED from match-functions/lib/fields.js. Do not edit here.
// Shared by the server (parse, match) and the browser (form, questions panel).
// One place defines every client field, its type, and the question that asks for it.

// Currencies offered in every dropdown, with their rate to AED.
// To add one, add a line here (e.g. USD: 3.6725). EUR moves, so update it regularly.
export const RATES_TO_AED = {
  AED: 1,
  EUR: 4.0,
};
export const CURRENCIES = Object.keys(RATES_TO_AED);

// The values above are only the starting point. The server replaces them with the live ECB rate
// (lib/rates.js) and sends them to the page, which calls setRates() too, so filters and prices agree.
export const RATES_INFO = { date: null, source: 'default' };

export function setRates(rates, info = {}) {
  for (const [code, rate] of Object.entries(rates || {})) {
    if (code in RATES_TO_AED && Number(rate) > 0) RATES_TO_AED[code] = Number(rate);
  }
  if (info.date !== undefined) RATES_INFO.date = info.date;
  if (info.source !== undefined) RATES_INFO.source = info.source;
}

// CANONICAL COPY: match-functions/lib/fields.js. public/match/shared/fields.js is generated from it.

export function toAED(amount, currency) {
  if (amount == null) return null;
  const rate = RATES_TO_AED[currency || 'AED'];
  return rate ? amount * rate : null;
}

export function fromAED(amountAED, currency) {
  const rate = RATES_TO_AED[currency || 'AED'];
  return amountAED == null || !rate ? null : amountAED / rate;
}

// Fixed choices so agents pick instead of typing.
export const MUST_HAVES = ['beach', 'sea view', 'golf', 'metro', 'schools', 'pool', 'gym', 'park', 'mall', 'kids area', 'pets'];

// "ready" = keys now; "2027" = keys by end of 2027; "2031_plus" = later is fine. Years roll forward each year.
const YEAR = new Date().getFullYear();
export const HANDOVER_VALUES = ['ready', ...[0, 1, 2, 3, 4].map((i) => String(YEAR + i)), `${YEAR + 5}_plus`];

// type: number | string | boolean | enum | list
// choices: shown as a dropdown in the form (numbers), 'live' = options loaded from current projects
export const FIELDS = {
  budget:           { type: 'number' },
  currency:         { type: 'enum', values: CURRENCIES },
  goal:             { type: 'enum', values: ['rent_out', 'resell', 'live_in'] },
  propertyType:     { type: 'enum', values: ['apartment', 'villa', 'townhouse', 'any'] },
  bedrooms:         { type: 'number', choices: [0, 1, 2, 3, 4, 5, 6, 7] }, // 0 = studio
  offplanOrReady:   { type: 'enum', values: ['offplan', 'ready', 'any'] },
  paymentMethod:    { type: 'enum', values: ['cash', 'payment_plan', 'mortgage'] },
  downPayment:      { type: 'number' },          // in the client's currency
  paymentPlanYears: { type: 'number', choices: [0, 1, 2, 3, 4, 5, 6, 7] }, // years of payments after handover; 0 = none
  priority:         { type: 'enum', values: ['rental_income', 'capital_growth', 'lifestyle'] },
  area:             { type: 'string', choices: 'live' },  // list comes from Pixxi projects
  nearSea:          { type: 'boolean' },
  handover:         { type: 'enum', values: HANDOVER_VALUES }, // keys wanted: now, by a year, or later
  mustHaves:        { type: 'list', values: MUST_HAVES },
  goldenVisa:       { type: 'boolean' },
  developer:        { type: 'string', choices: 'live' },  // list comes from Pixxi projects
  decisionTimeline: { type: 'enum', values: ['this_week', 'this_month', '1_3_months', '3_6_months', 'later'], agentOnly: true }, // never used in search
};

export const FIELD_NAMES = Object.keys(FIELDS);

export function emptyClient() {
  return Object.fromEntries(FIELD_NAMES.map((f) => [f, FIELDS[f].type === 'list' ? [] : null]));
}

// Coerce one value to its field type; anything invalid becomes null (or [] for lists).
export function normalizeValue(field, v) {
  const def = FIELDS[field];
  if (def.type === 'list') {
    if (!Array.isArray(v)) v = typeof v === 'string' ? v.split(',') : [];
    const out = [...new Set(v.map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
    return def.values ? out.filter((s) => def.values.includes(s)) : out;
  }
  if (v === undefined || v === null || v === '') return null;
  switch (def.type) {
    case 'number': {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    case 'boolean':
      if (v === true || v === 'true') return true;
      if (v === false || v === 'false') return false;
      return null;
    case 'enum':
      return def.values.includes(v) ? v : null;
    default:
      return String(v).trim() || null;
  }
}

export function normalizeClient(obj = {}) {
  const out = emptyClient();
  for (const f of FIELD_NAMES) out[f] = normalizeValue(f, obj[f]);
  return out;
}

export function isFilled(v) {
  return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '';
}

// The question guide. key = filter question (1-8), otherwise ranking.
// match: 'all' = every linked field must be filled, 'any' = one is enough.
export const QUESTIONS = [
  { n: 1, key: true, fields: ['budget', 'currency'], match: 'all',
    sq: 'Sa është buxheti dhe në çfarë monedhe?', en: 'What is your budget, and in which currency?' },
  { n: 2, key: true, fields: ['goal'],
    sq: 'Do ta jepni me qira, ta rishisni apo do të jetoni vetë?', en: 'Will you rent it out, resell it, or live in it?' },
  { n: 3, key: true, fields: ['propertyType'],
    sq: 'Apartament, vilë apo townhouse?', en: 'Apartment, villa or townhouse?' },
  { n: 4, key: true, fields: ['bedrooms'],
    sq: 'Sa dhoma gjumi ju duhen?', en: 'How many bedrooms do you need?' },
  { n: 5, key: true, fields: ['offplanOrReady'],
    sq: 'E gatshme apo në ndërtim (off-plan)?', en: 'Ready or off-plan?' },
  { n: 6, key: true, fields: ['paymentMethod'],
    sq: 'Si do të paguani: cash, plan pagese apo kredi hipotekore?', en: 'Will you pay cash, use a payment plan, or a mortgage?' },
  { n: 7, key: true, fields: ['downPayment'],
    sq: 'Sa keni në dispozicion për paradhënien?', en: 'How much do you have available for the down payment?' },
  { n: 8, key: true, fields: ['paymentPlanYears'],
    sq: 'Doni të vazhdoni pagesat pas dorëzimit? Për sa vite?', en: 'Do you want to keep paying after handover? For how many years?' },
  { n: 9, fields: ['priority'],
    sq: 'Çfarë ka më shumë rëndësi: të ardhurat nga qiraja, rritja e vlerës apo stili i jetesës?',
    en: 'What matters most: rental income, value growth, or lifestyle?' },
  { n: 10, fields: ['area', 'nearSea'], match: 'any',
    sq: 'Në cilën zonë e kërkoni? Afër detit?', en: 'Which area are you looking at? Near the sea?' },
  { n: 11, fields: ['handover'],
    sq: 'Kur i doni çelësat?', en: 'When do you want the keys?' },
  { n: 12, fields: ['mustHaves'],
    sq: 'Çfarë duhet të ketë patjetër? (plazh, golf, metro, shkolla…)', en: 'Any must-haves? (beach, golf, metro, schools…)' },
  { n: 13, fields: ['goldenVisa'],
    sq: 'Ju intereson viza e rezidencës (Golden Visa)?', en: 'Are you interested in a residence visa (Golden Visa)?' },
  { n: 14, fields: ['developer'],
    sq: 'Keni ndonjë developer të preferuar?', en: 'Do you have a preferred developer?' },
  { n: 15, fields: ['decisionTimeline'],
    sq: 'Kur planifikoni të vendosni?', en: 'When do you plan to decide?' },
];

export function isAnswered(q, client) {
  const filled = q.fields.map((f) => isFilled(client[f]));
  return q.match === 'any' ? filled.some(Boolean) : filled.every(Boolean);
}

// Numbers of the KEY questions (1-8) still unanswered, in order.
export function missingQuestions(client) {
  return QUESTIONS.filter((q) => q.key && !isAnswered(q, client)).map((q) => q.n);
}
