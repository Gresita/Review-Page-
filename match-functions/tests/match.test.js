import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterProjects, applyGoldenVisaPreference, rankingInput } from '../lib/match.js';
import { parseCsv, rowsToProjects, rowsToExtras, isFakeFile } from '../lib/csv.js';
import { mapPixxiProject } from '../lib/pixxi.js';
import { joinProjects } from '../lib/projects.js';
import { normalizeClient, missingQuestions, emptyClient } from '../lib/fields.js';

const projects = rowsToProjects(parseCsv(readFileSync(new URL('./fixtures/projects.FAKE.csv', import.meta.url), 'utf8')));
const ids = (list) => list.map((p) => p.id).sort();
const c = (o) => normalizeClient(o);

test('CSV import reads the new columns', () => {
  const s03 = projects.find((p) => p.id === 'S03');
  assert.deepEqual(s03.propertyTypes, ['villa', 'townhouse']);
  assert.equal(s03.minDownPaymentPct, 20);
  assert.equal(s03.developer, 'Desert Rose Homes');
  assert.equal(s03.goldenVisaEligible, true);
  assert.equal(projects.find((p) => p.id === 'S04').goldenVisaEligible, null);
  assert.equal(projects.find((p) => p.id === 'S01').minDownPaymentPct, null);
});

test('CSV import rejects a missing column and a bad boolean', () => {
  assert.throws(() => rowsToProjects([['id', 'name'], ['x', 'y']]), /missing columns/);
  const rows = parseCsv(readFileSync(new URL('./fixtures/projects.FAKE.csv', import.meta.url), 'utf8'));
  rows[1][rows[0].indexOf('goldenVisaEligible')] = 'maybe';
  assert.throws(() => rowsToProjects(rows), /true\/false/);
});

test('empty client filters nothing', () => {
  assert.equal(filterProjects(projects, emptyClient()).passed.length, projects.length);
});

test('propertyType must be in propertyTypes unless any', () => {
  assert.deepEqual(ids(filterProjects(projects, c({ propertyType: 'villa' })).passed), ['S03', 'S05', 'S10']);
  assert.equal(filterProjects(projects, c({ propertyType: 'any' })).passed.length, projects.length);
});

test('down payment converted to AED vs price x minDownPaymentPct', () => {
  // S03: 4.2m x 20% = 840k AED. 200k EUR = 800k AED -> excluded; 250k EUR = 1m AED -> kept.
  const low = filterProjects(projects, c({ downPayment: 200000, currency: 'EUR' }));
  assert.ok(!low.passed.some((p) => p.id === 'S03'));
  assert.ok(low.excluded.down_payment >= 1);
  const ok = filterProjects(projects, c({ downPayment: 250000, currency: 'EUR' }));
  assert.ok(ok.passed.some((p) => p.id === 'S03'));
  // minDownPaymentPct null (S01, S05, S09) is never excluded by down payment
  const tiny = filterProjects(projects, c({ downPayment: 1 }));
  assert.deepEqual(ids(tiny.passed), ['S01', 'S05', 'S09']);
});

test('budget is converted to AED', () => {
  // 450k EUR = 1,800,000 AED
  const r = filterProjects(projects, c({ budget: 450000, currency: 'EUR' }));
  assert.ok(r.passed.every((p) => p.priceFromAED <= 1800000));
  assert.ok(r.passed.some((p) => p.id === 'S01')); // 1.65m
});

test('golden visa true: eligible first, unknown next, false last, none excluded', () => {
  const client = c({ goldenVisa: true });
  const { passed } = filterProjects(projects, client);
  assert.equal(passed.length, projects.length);
  const sorted = applyGoldenVisaPreference(passed, client);
  const tiers = sorted.map((p) => p.goldenVisaEligible);
  const firstNull = tiers.indexOf(null), firstFalse = tiers.indexOf(false);
  assert.ok(tiers.slice(0, firstNull).every((v) => v === true));
  assert.ok(firstNull < firstFalse);
  // goldenVisa not true: order untouched
  assert.deepEqual(applyGoldenVisaPreference(passed, c({})), passed);
});

test('decisionTimeline never reaches ranking', () => {
  assert.ok(!('decisionTimeline' in rankingInput(c({ decisionTimeline: 'next month' }))));
});

test('missingQuestions lists unanswered key questions in order', () => {
  assert.deepEqual(missingQuestions(emptyClient()), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(missingQuestions(c({ budget: 1e6 })), [1, 2, 3, 4, 5, 6, 7, 8]); // currency still missing
  assert.deepEqual(
    missingQuestions(c({ budget: 1e6, currency: 'AED', propertyType: 'any', paymentMethod: 'cash', bedrooms: 0 })),
    [2, 5, 7, 8],
  );
});

// ---- Pixxi mapping and Firestore join (FAKE values in the real Pixxi response shape) ----
const fakePixxi = {
  id: 900001, title: 'FAKE Pixxi Project', price: 2430888, status: 'ACTIVE', listingType: 'NEW',
  propertyType: ['APARTMENT', 'PENTHOUSE', 'TOWNHOUSE', 'OFFICE'], region: 'Dubai Harbour', community: null,
  cityName: 'Dubai', developer: 'FAKE Developer', amenities: ['Shared Pool'], views: ['SEA_VIEW'],
  photos: ['https://example.com/fake-1.jpg', 'https://example.com/fake-2.jpg'],
  newParam: { handoverTime: '2028-09-01 00:00:00', bedroomMin: '1', bedroomMax: '3',
    paymentPlan: '{"one":"10","two":"80","three":"10","four":0}' },
};

test('Pixxi project maps to match fields', () => {
  const p = mapPixxiProject(fakePixxi, new Date('2026-11-20'));
  assert.equal(p.pixxiId, '900001');
  assert.deepEqual(p.propertyTypes, ['apartment', 'townhouse']);
  assert.deepEqual(p.bedrooms, [1, 2, 3]);
  assert.equal(p.priceFromAED, 2430888);
  assert.equal(p.status, 'offplan');
  assert.equal(p.handover, '2028-Q3');
  assert.equal(p.minDownPaymentPct, 10);   // paymentPlan "one"
  assert.equal(p.postHandoverYears, 0);    // "four" = 0%
  assert.equal(p.nearSea, true);
  assert.deepEqual(p.tags, ['shared pool', 'sea view']);
  assert.equal(p.goldenVisaEligible, null); // never computed
  assert.equal(p.photo, 'https://example.com/fake-1.jpg');
  assert.equal(mapPixxiProject({ ...fakePixxi, photos: [] }).photo, null);
  const past = mapPixxiProject({ ...fakePixxi, newParam: { ...fakePixxi.newParam, handoverTime: '2024-01-01 00:00:00' } });
  assert.equal(past.status, 'ready');
});

test('Firestore extras override Pixxi by pixxiId; tags are added', () => {
  const p = mapPixxiProject(fakePixxi, new Date('2026-11-20'));
  const extras = new Map([['900001', { goldenVisaEligible: true, minDownPaymentPct: 20, rentalYield: 7.1, tags: ['metro'] }]]);
  const [j] = joinProjects([p], extras);
  assert.equal(j.goldenVisaEligible, true);
  assert.equal(j.minDownPaymentPct, 20);
  assert.equal(j.rentalYield, 7.1);
  assert.deepEqual(j.tags, ['shared pool', 'sea view', 'metro']);
  assert.equal(j.developer, 'FAKE Developer');
  assert.deepEqual(joinProjects([p], new Map())[0], p);
});

test('extras CSV import: pixxiId required, blanks not set, FAKE files refused', () => {
  const rows = parseCsv('pixxiId,goldenVisaEligible,minDownPaymentPct,propertyTypes\n900001,po,,villa|townhouse\n900002,,15,\n');
  assert.deepEqual(rowsToExtras(rows), [
    { id: '900001', doc: { goldenVisaEligible: true, propertyTypes: ['villa', 'townhouse'] } },
    { id: '900002', doc: { minDownPaymentPct: 15 } },
  ]);
  assert.throws(() => rowsToExtras(parseCsv('goldenVisaEligible\ntrue\n')), /missing columns: pixxiId/);
  assert.throws(() => rowsToExtras(parseCsv('pixxiId,propertyTypes\n1,castle\n')), /unknown propertyTypes/);
  assert.throws(() => rowsToExtras(parseCsv('pixxiId,price\n1,5\n')), /unknown columns: price/);
  assert.ok(isFakeFile(readFileSync(new URL('./fixtures/projects.FAKE.csv', import.meta.url), 'utf8')));
});

test('fixed choices: mustHaves keeps only known values, handover is a choice', async () => {
  const { HANDOVER_VALUES } = await import('../lib/fields.js');
  const x = c({ mustHaves: ['Beach', 'golf', 'helipad'], handover: HANDOVER_VALUES[2], decisionTimeline: 'this_week' });
  assert.deepEqual(x.mustHaves, ['beach', 'golf']);
  assert.equal(x.handover, HANDOVER_VALUES[2]);
  assert.equal(c({ handover: 'whenever' }).handover, null);
  assert.equal(x.decisionTimeline, 'this_week');
});

test('agent choices filter: area, developer and handover', async () => {
  const { HANDOVER_VALUES } = await import('../lib/fields.js');
  assert.deepEqual(ids(filterProjects(projects, c({ area: 'dubai marina' })).passed), ['S01']);
  assert.deepEqual(ids(filterProjects(projects, c({ developer: 'Creekline' })).passed), ['S02', 'S04', 'S09']);
  const ready = filterProjects(projects, c({ handover: 'ready' }));
  assert.deepEqual(ids(ready.passed), ['S01', 'S05', 'S09']);
  assert.equal(ready.excluded.handover, 7);
  // FAKE fixture has 2026-Q4 .. 2028-Q3; "by 2027" keeps ready + 2026/2027 handovers.
  const by2027 = filterProjects(projects, c({ handover: '2027' }));
  assert.deepEqual(ids(by2027.passed), ['S01', 'S02', 'S04', 'S05', 'S07', 'S09', 'S10']);
  assert.equal(filterProjects(projects, c({ handover: HANDOVER_VALUES.at(-1) })).passed.length, projects.length);
});

test('rule ranking puts matched must-haves first and explains why', async () => {
  const { ruleRank } = await import('../lib/rank.js');
  const r = ruleRank({ mustHaves: ['beach'] }, projects, 'en');
  const beachIds = projects.filter((p) => p.tags.includes('beach')).map((p) => p.id);
  assert.deepEqual(r.slice(0, beachIds.length).map((x) => x.id).sort(), beachIds.sort());
  assert.match(r[0].reason, /Matches: beach/);
  assert.match(r.at(-1).reason, /Missing: beach/);
});

test('closest projects fill up to 5 when few match, closest first', async () => {
  const { closestProjects } = await import('../lib/match.js');
  const client = c({ area: 'Dubai Marina', budget: 1500000, currency: 'AED' });
  assert.equal(filterProjects(projects, client).passed.length, 0); // S01 Marina is 1.65m
  const close = closestProjects(projects, client, 5);
  assert.equal(close.length, 5);
  assert.equal(close[0].id, 'S01');                   // misses only budget, by 10%
  assert.deepEqual(close[0].missed, ['over_budget']);
  assert.equal(close[0].overBudgetPct, 10);
  assert.ok(close.slice(1).every((p) => p.missed.length >= 1));
  assert.deepEqual(closestProjects(projects, client, 0), []);
});
