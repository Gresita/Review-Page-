// Hard filters: every choice the agent makes in the form narrows the results.
// Empty client fields never filter anything out, and a project whose value is unknown is kept.
// Ranking (lib/rank.js) then orders what is left by mustHaves, priority, sea, goal.
import { toAED } from './fields.js';

const norm = (s) => String(s || '').trim().toLowerCase();
const yearOf = (h) => Number((/^(\d{4})/.exec(h || '') || [])[1]) || null;

// Each filter returns a reason string when the project fails, or null when it passes.
const FILTERS = [
  (p, c) => {
    if (c.budget == null) return null;
    const budgetAED = toAED(c.budget, c.currency);
    return p.priceFromAED > budgetAED ? 'over_budget' : null;
  },
  (p, c) => {
    if (!c.propertyType || c.propertyType === 'any' || !p.propertyTypes.length) return null;
    return p.propertyTypes.includes(c.propertyType) ? null : 'property_type';
  },
  (p, c) => {
    if (c.bedrooms == null || !p.bedrooms.length) return null;
    return p.bedrooms.includes(c.bedrooms) ? null : 'bedrooms';
  },
  (p, c) => {
    if (!c.offplanOrReady || c.offplanOrReady === 'any' || !p.status) return null;
    return p.status === c.offplanOrReady ? null : 'offplan_or_ready';
  },
  (p, c) => {
    if (!c.paymentPlanYears || p.postHandoverYears == null) return null;
    return p.postHandoverYears >= c.paymentPlanYears ? null : 'payment_plan_years';
  },
  (p, c) => {
    if (c.downPayment == null || p.minDownPaymentPct == null) return null;
    const needed = (p.priceFromAED * p.minDownPaymentPct) / 100;
    return toAED(c.downPayment, c.currency) >= needed ? null : 'down_payment';
  },
  (p, c) => {
    if (!c.area || !p.area) return null;
    return norm(p.area) === norm(c.area) ? null : 'area';
  },
  (p, c) => {
    if (!c.developer || !p.developer) return null;
    return norm(p.developer) === norm(c.developer) ? null : 'developer';
  },
  // Keys wanted: "ready" = ready projects only; a year = ready, or handover by the end of that year;
  // "<year>_plus" = anything.
  (p, c) => {
    if (!c.handover || c.handover.endsWith('_plus') || !p.status) return null;
    if (c.handover === 'ready') return p.status === 'ready' ? null : 'handover';
    if (p.status === 'ready') return null;
    const y = yearOf(p.handover);
    return y === null || y <= Number(c.handover) ? null : 'handover';
  },
];

// Every requirement a project misses, e.g. ['area', 'over_budget'].
export function failedFilters(p, client) {
  return FILTERS.map((f) => f(p, client)).filter(Boolean);
}

export function filterProjects(projects, client) {
  const passed = [];
  const excluded = {};
  for (const p of projects) {
    const reason = failedFilters(p, client)[0];
    if (reason) excluded[reason] = (excluded[reason] || 0) + 1;
    else passed.push(p);
  }
  return { passed, excluded };
}

// How far over the client's budget a project is, in percent (0 when within budget or unknown).
export function overBudgetPct(p, client) {
  if (client.budget == null || p.priceFromAED == null) return 0;
  const budgetAED = toAED(client.budget, client.currency);
  return budgetAED && p.priceFromAED > budgetAED ? Math.round(((p.priceFromAED - budgetAED) / budgetAED) * 100) : 0;
}

// Projects that miss some requirements, closest first: fewest misses (a budget overrun of 10% or less
// counts as half a miss), then smallest budget overrun, then price.
// Each comes back with `missed` (the requirements it does not meet) and `overBudgetPct`.
const SMALL_OVERRUN_PCT = 10;

export function closestProjects(projects, client, count) {
  if (count <= 0) return [];
  const weight = (missed, over) =>
    missed.reduce((n, r) => n + (r === 'over_budget' && over <= SMALL_OVERRUN_PCT ? 0.5 : 1), 0);
  return projects
    .map((p) => {
      const missed = failedFilters(p, client), over = overBudgetPct(p, client);
      return { p, missed, over, w: weight(missed, over) };
    })
    .filter((x) => x.missed.length > 0)
    .sort((a, b) => a.w - b.w || a.over - b.over
      || (a.p.priceFromAED ?? Infinity) - (b.p.priceFromAED ?? Infinity))
    .slice(0, count)
    .map((x) => ({ ...x.p, missed: x.missed, overBudgetPct: x.over }));
}

// goldenVisa == true: eligible first, unknown (null) next, not eligible last. Nothing is excluded.
export function goldenVisaTier(p, client) {
  if (client.goldenVisa !== true) return 0;
  return p.goldenVisaEligible === true ? 0 : p.goldenVisaEligible === null ? 1 : 2;
}

// Stable sort by golden-visa tier, keeping the ranking order inside each tier.
export function applyGoldenVisaPreference(list, client) {
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => goldenVisaTier(a.p, client) - goldenVisaTier(b.p, client) || a.i - b.i)
    .map((x) => x.p);
}

// What the ranking step may see about the client. decisionTimeline is deliberately absent.
export function rankingInput(client) {
  const { priority, mustHaves, developer, nearSea, area, handover, goal, paymentMethod } = client;
  return { priority, mustHaves, developer, nearSea, area, handover, goal, paymentMethod };
}
