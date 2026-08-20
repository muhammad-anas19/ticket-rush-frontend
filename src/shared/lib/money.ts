/**
 * The ONE place currency crosses between display and storage.
 *
 * The backend stores integer **minor units** — `1999` means $19.99 — because binary floating point
 * cannot represent 0.1, so `0.1 + 0.2 === 0.30000000000000004`, errors accumulate across thousands of
 * rows, and `WHERE amount = 19.99` matches nothing when the stored value is 19.989999999999998.
 *
 * Keeping the conversion in one tested file matters more than it looks. Scattered `/100` and `*100`
 * calls are how a price becomes 100× wrong — and *that* bug is at least loud. The quiet version is a
 * rounding error that only shows up in reconciliation.
 */

const MINOR_UNITS_PER_MAJOR = 100;

/** `1999` → `"$19.99"`. Display only — never feed this back into a calculation. */
export function formatCents(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / MINOR_UNITS_PER_MAJOR);
}

/**
 * `"19.99"` → `1999`. The form boundary.
 *
 * `Math.round`, not `Math.floor` or a bare cast: `19.99 * 100` is `1998.9999999999998` in IEEE 754, so
 * flooring silently charges a cent less. Rounding is the only correct choice here, and the reason is the
 * same float behaviour that made integer cents necessary in the first place.
 */
export function majorToCents(major: string | number): number {
  const value = typeof major === 'string' ? Number.parseFloat(major) : major;
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot convert "${major}" to cents`);
  }
  return Math.round(value * MINOR_UNITS_PER_MAJOR);
}

/** `1999` → `19.99`, for populating a form field from stored data. */
export function centsToMajor(cents: number): number {
  return cents / MINOR_UNITS_PER_MAJOR;
}

/**
 * Known limitation, recorded rather than discovered later: **"cents" is not universal.**
 *
 * JPY has no minor unit — ¥500 is `500`, not `50000` — so a hardcoded divisor of 100 is wrong the day a
 * second currency appears. Stripe calls these "zero-decimal currencies" and documents the list.
 *
 * This project is single-currency, so the constant above is fine. It is a constant rather than an inline
 * `100` precisely so that the day it becomes wrong, there is exactly one line to change.
 */
