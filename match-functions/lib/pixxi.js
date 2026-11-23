// Live projects from the Pixxi Data API (https://api-docs.pixxicrm.com).
// Limits: 2,000 requests/hour per token, 2 s between requests, 500 records per page.
const BASE = 'https://dataapi.pixxicrm.ae';
const PAGE_SIZE = 500;
const MIN_GAP_MS = 2100;
const MAX_PAGES = 20;
const TTL_MS = 60 * 60 * 1000; // 1-hour cache

let cache = null;     // { at, projects }
let inflight = null;  // one refresh at a time per instance

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page, token) {
  const res = await fetch(`${BASE}/pixxiapi/v1/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-PIXXI-TOKEN': token },
    body: JSON.stringify({ listingType: 'NEW', page, size: PAGE_SIZE, sortType: 'DESC' }),
  });
  if (!res.ok) throw new Error(`Pixxi HTTP ${res.status}`);
  const body = await res.json();
  if (body.statusCode !== 200 || !body.data) throw new Error(`Pixxi error: ${body.message || 'no data'}`);
  return body.data;
}

// Every NEW project in Pixxi, ACTIVE only, mapped. Used by the hourly refresh and as a fallback.
export async function fetchPixxiAll() {
  const token = (process.env.PIXXI_API_KEY || '').trim();
  if (!token) throw new Error('PIXXI_API_KEY is not set');
  const raw = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(MIN_GAP_MS);
    const data = await fetchPage(page, token);
    const list = data.list || [];
    raw.push(...list);
    if (list.length < PAGE_SIZE || raw.length >= (data.totalSize ?? Infinity)) break;
  }
  const now = new Date();
  return raw.filter((p) => p.status === 'ACTIVE').map((p) => mapPixxiProject(p, now));
}

// Cached for 1 hour. If a refresh fails and an older copy exists, the older copy is used.
export async function fetchPixxiProjects() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.projects;
  inflight ??= fetchPixxiAll()
    .then((projects) => {
      cache = { at: Date.now(), projects };
      return projects;
    })
    .catch((err) => {
      if (cache) {
        console.error('Pixxi refresh failed, serving cached copy:', err.message);
        return cache.projects;
      }
      throw err;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

const TYPE_MAP = {
  APARTMENT: 'apartment', PENTHOUSE: 'apartment', HOTEL_APARTMENT: 'apartment', DUPLEX: 'apartment',
  DUPLEX_APARTMENT: 'apartment', LOFT: 'apartment', LOFT_APARTMENT: 'apartment', TRIPLEX: 'apartment',
  VILLA: 'villa', DUPLEX_VILLA: 'villa', TWIN_HOUSE: 'villa', COMPOUND: 'villa',
  TOWNHOUSE: 'townhouse',
};

const num = (v) => {
  if (v === null || v === undefined || v === '' || v === 'null') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function parsePaymentPlan(s) {
  if (!s) return null;
  try {
    const o = typeof s === 'string' ? JSON.parse(s) : s;
    return { one: num(o.one), two: num(o.two), three: num(o.three), four: num(o.four) };
  } catch {
    return null;
  }
}

// "2027-12-01 00:00:00" -> { label: "2027-Q4", date }
function parseHandover(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return { label: `${m[1]}-Q${Math.ceil(+m[2] / 3)}`, date };
}

function bedroomRange(min, max) {
  const lo = num(min), hi = num(max);
  if (lo === null && hi === null) return [];
  const a = lo ?? hi, b = hi ?? lo;
  if (b < a || b - a > 10) return [a];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const tagWord = (s) => String(s).trim().toLowerCase().replace(/_/g, ' ');

export function mapPixxiProject(p, now = new Date()) {
  const np = p.newParam || {};
  const plan = parsePaymentPlan(np.paymentPlan);
  const handover = parseHandover(np.handoverTime);
  const views = Array.isArray(p.views) ? p.views : [];
  const community = p.community && p.community !== 'null' ? p.community : null;
  return {
    id: String(p.id),
    pixxiId: String(p.id),
    name: p.title || '',
    photo: (Array.isArray(p.photos) ? p.photos : []).find((u) => /^https:\/\//.test(u)) || null,
    developer: p.developer || null,
    area: community ? `${community}, ${p.region}` : p.region || null,
    city: p.cityName || null,
    propertyTypes: [...new Set((p.propertyType || []).map((t) => TYPE_MAP[t]).filter(Boolean))],
    bedrooms: bedroomRange(np.bedroomMin, np.bedroomMax),
    priceFromAED: num(p.price) || null,
    status: handover ? (handover.date > now ? 'offplan' : 'ready') : null,
    handover: handover?.label ?? null,
    // Pixxi gives post-handover as a percentage, not years: 0% -> 0 years, >0% -> unknown (set in Firestore).
    postHandoverYears: plan ? (plan.four > 0 ? null : 0) : null,
    minDownPaymentPct: plan?.one ?? null,
    nearSea: views.includes('SEA_VIEW') ? true : null,
    tags: [...new Set([...(p.amenities || []), ...views].map(tagWord).filter(Boolean))],
    rentalYield: null,
    goldenVisaEligible: null,
  };
}
