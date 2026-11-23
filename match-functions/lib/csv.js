// CSV parsing for the Firestore import (match_projects) and the FAKE test fixture.

// Minimal RFC 4180 parser: quoted fields, "" escapes, commas/newlines inside quotes.
// Rows whose first cell starts with "#" are comments and are skipped.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== '') && !r[0].trim().startsWith('#'));
}

export function isFakeFile(text) {
  return /^﻿?#\s*FAKE/i.test(text);
}

export function convertCell(type, raw, ctx) {
  const v = (raw ?? '').trim();
  if (type === 'list') return v ? v.split('|').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
  if (type === 'intList') {
    return v ? v.split('|').map((s) => {
      const n = Number(s.trim());
      if (!Number.isInteger(n)) throw new Error(`${ctx}: "${s}" is not a whole number`);
      return n;
    }) : [];
  }
  if (v === '') return null;
  if (type === 'number') {
    const n = Number(v.replace(/[, ]/g, ''));
    if (!Number.isFinite(n)) throw new Error(`${ctx}: "${v}" is not a number`);
    return n;
  }
  if (type === 'boolean') {
    if (/^(true|yes|po|1)$/i.test(v)) return true;
    if (/^(false|no|jo|0)$/i.test(v)) return false;
    throw new Error(`${ctx}: "${v}" is not true/false (leave blank if unknown)`);
  }
  return v;
}

// Typed rows. `required` columns must exist in the header; other known columns are optional.
export function rowsToRecords(rows, columns, { required = Object.keys(columns) } = {}) {
  const [header, ...body] = rows;
  const cols = header.map((h) => h.trim());
  const missing = required.filter((c) => !cols.includes(c));
  if (missing.length) throw new Error(`CSV is missing columns: ${missing.join(', ')}`);
  const unknown = cols.filter((c) => c && !(c in columns));
  if (unknown.length) throw new Error(`CSV has unknown columns: ${unknown.join(', ')}`);
  return body.map((r, i) => {
    const rec = {};
    for (const col of cols) if (col) rec[col] = convertCell(columns[col], r[cols.indexOf(col)], `row ${i + 2}, ${col}`);
    return rec;
  });
}

// ---- Firestore match_projects: the extra fields Pixxi does not have ----
// Document id = pixxiId. Blank cell = not set (Pixxi's value, or unknown, is used).
export const EXTRA_COLUMNS = {
  pixxiId: 'string',
  goldenVisaEligible: 'boolean', // set by admins only, never by AI
  minDownPaymentPct: 'number',   // overrides Pixxi paymentPlan "one"
  postHandoverYears: 'number',
  rentalYield: 'number',
  developer: 'string',           // overrides Pixxi developer
  propertyTypes: 'list',         // overrides Pixxi types: apartment|villa|townhouse
  nearSea: 'boolean',            // overrides Pixxi (SEA_VIEW)
  tags: 'list',                  // added to Pixxi amenities/views
};
const PROPERTY_TYPES = ['apartment', 'villa', 'townhouse'];

export function rowsToExtras(rows) {
  const records = rowsToRecords(rows, EXTRA_COLUMNS, { required: ['pixxiId'] });
  const seen = new Set();
  return records.map((rec, i) => {
    if (!rec.pixxiId) throw new Error(`row ${i + 2}: pixxiId is required`);
    if (seen.has(rec.pixxiId)) throw new Error(`row ${i + 2}: duplicate pixxiId "${rec.pixxiId}"`);
    seen.add(rec.pixxiId);
    const bad = (rec.propertyTypes || []).filter((t) => !PROPERTY_TYPES.includes(t));
    if (bad.length) throw new Error(`row ${i + 2}: unknown propertyTypes ${bad.join(', ')}`);
    const doc = {};
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'pixxiId') continue;
      if (v === null || (Array.isArray(v) && !v.length)) continue;
      doc[k] = v;
    }
    return { id: rec.pixxiId, doc };
  });
}

// ---- FAKE fixture format (full projects), used by tests only ----
export const FIXTURE_COLUMNS = {
  id: 'string', name: 'string', developer: 'string', area: 'string',
  propertyTypes: 'list', bedrooms: 'intList', priceFromAED: 'number', status: 'string',
  handover: 'string', postHandoverYears: 'number', minDownPaymentPct: 'number', nearSea: 'boolean',
  tags: 'list', rentalYield: 'number', goldenVisaEligible: 'boolean',
};

export function rowsToProjects(rows) {
  return rowsToRecords(rows, FIXTURE_COLUMNS).map((p, i) => {
    if (!p.id) throw new Error(`row ${i + 2}: id is required`);
    if (p.priceFromAED == null) throw new Error(`row ${i + 2}: priceFromAED is required`);
    return p;
  });
}
