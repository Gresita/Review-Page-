// Ranking: points for each client preference a project matches (no AI).
// Hard filters already ran; this only orders the projects that passed and explains why.

const WORDS = {
  sq: {
    area: 'zona', developer: 'developeri', sea: 'afër detit', yield: (y) => `kthim ${y}%`,
    offplan: 'off-plan (rritje vlere)', ready: 'gati tani', handover: 'çelësat në kohë', late: 'çelësat vonë',
    matches: 'Përputhet', missing: 'Mungon', none: 'Asnjë preferencë e veçantë.',
  },
  en: {
    area: 'area', developer: 'developer', sea: 'near the sea', yield: (y) => `${y}% yield`,
    offplan: 'off-plan (growth)', ready: 'ready now', handover: 'keys on time', late: 'keys late',
    matches: 'Matches', missing: 'Missing', none: 'No specific preferences.',
  },
};

const MUST_LABEL = {
  sq: { beach: 'plazh', 'sea view': 'pamje nga deti', golf: 'golf', metro: 'metro', schools: 'shkolla', pool: 'pishinë',
    gym: 'palestër', park: 'park', mall: 'qendër tregtare', 'kids area': 'kënd lojërash', pets: 'kafshë' },
  en: {},
};

// Words in Pixxi amenities/views that count as each must-have.
const MUST_TAGS = {
  beach: ['beach'], 'sea view': ['sea view', 'sea'], golf: ['golf'], metro: ['metro'],
  schools: ['school', 'nursery'], pool: ['pool'], gym: ['gym', 'fitness'], park: ['park', 'garden'],
  mall: ['mall', 'retail', 'shop'], 'kids area': ['kid', 'children', 'play'], pets: ['pet'],
};

const norm = (s) => String(s || '').trim().toLowerCase();
const yearOf = (h) => (/^(\d{4})/.exec(h || '') || [])[1];

function hasMust(p, m) {
  if ((m === 'beach' || m === 'sea view') && p.nearSea === true) return true;
  const words = MUST_TAGS[m] || [m];
  return p.tags.some((t) => words.some((w) => t.includes(w)));
}

export function scoreProject(prefs, p, lang = 'sq') {
  const w = WORDS[lang] || WORDS.sq;
  let score = 50;
  const plus = [], minus = [];

  if (prefs.area && p.area) {
    const a = norm(prefs.area), b = norm(p.area);
    if (b.includes(a) || a.includes(b)) { score += 15; plus.push(w.area); }
  }
  if (prefs.developer && norm(prefs.developer) === norm(p.developer)) { score += 15; plus.push(w.developer); }
  if (prefs.nearSea === true && p.nearSea === true) { score += 10; plus.push(w.sea); }

  for (const m of prefs.mustHaves || []) {
    const label = MUST_LABEL[lang]?.[m] || m;
    if (hasMust(p, m)) { score += 8; plus.push(label); } else { score -= 8; minus.push(label); }
  }

  if (prefs.handover) {
    const want = prefs.handover;
    if (want === 'ready') {
      if (p.status === 'ready') { score += 10; plus.push(w.ready); } else if (p.status) { score -= 10; minus.push(w.ready); }
    } else if (!want.endsWith('_plus') && p.status === 'offplan' && yearOf(p.handover)) {
      if (+yearOf(p.handover) <= +want) { score += 8; plus.push(w.handover); } else { score -= 8; minus.push(w.late); }
    }
  }

  const wantsIncome = prefs.priority === 'rental_income' || prefs.goal === 'rent_out';
  if (wantsIncome && p.rentalYield != null) {
    score += Math.round((p.rentalYield - 6) * 4);
    plus.push(w.yield(p.rentalYield));
  }
  if (prefs.priority === 'capital_growth' && p.status === 'offplan') { score += 8; plus.push(w.offplan); }
  if (prefs.priority === 'lifestyle') {
    const n = ['pool', 'gym', 'park', 'beach'].filter((m) => hasMust(p, m)).length;
    score += n * 3;
  }

  const reason = [
    plus.length ? `${w.matches}: ${plus.join(', ')}.` : '',
    minus.length ? `${w.missing}: ${minus.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
  return { id: p.id, score: Math.max(0, Math.min(100, score)), reason };
}

// Returns [{ id, score, reason }], best first. Ties keep the incoming order.
export function ruleRank(prefs, candidates, lang = 'sq') {
  return candidates
    .map((p, i) => ({ ...scoreProject(prefs, p, lang), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ i, ...r }) => r);
}
