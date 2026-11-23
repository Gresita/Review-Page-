// EUR -> AED from the European Central Bank's daily reference rate (via frankfurter.dev, free, no key).
// The dirham is pegged to the US dollar (1 USD = 3.6725 AED), so EUR->AED = EUR->USD x 3.6725.
// ECB publishes once per business day (~16:00 CET); we check every hour, so a new rate is picked up the same day.
import { setRates } from './fields.js';

export const AED_PER_USD = 3.6725;
const SOURCE_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD';
const TTL_MS = 60 * 60 * 1000;

let cache = null; // { at, info }

export function eurToAedFromUsd(usdPerEur) {
  if (!(usdPerEur > 0.5 && usdPerEur < 2)) throw new Error(`implausible EUR/USD rate ${usdPerEur}`);
  return Math.round(usdPerEur * AED_PER_USD * 10000) / 10000;
}

// -> { rates: { AED: 1, EUR: 4.0359 }, date: '2026-11-20', source: 'ECB' }
export async function fetchRates() {
  const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`rates HTTP ${res.status}`);
  const body = await res.json();
  return { rates: { AED: 1, EUR: eurToAedFromUsd(body?.rates?.USD) }, date: body.date || null, source: 'ECB' };
}

// Used when there is no saved copy yet (local testing, first minutes after a deploy). Keeps the last good rate on failure.
export async function ensureRates() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.info;
  try {
    const info = await fetchRates();
    cache = { at: Date.now(), info };
    setRates(info.rates, { date: info.date, source: info.source });
    return info;
  } catch (err) {
    console.error('Exchange rate refresh failed, keeping the previous rate:', err.message);
    return cache?.info ?? null;
  }
}
