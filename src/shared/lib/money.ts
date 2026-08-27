const MINOR_UNITS_PER_MAJOR = 100;

export function formatCents(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / MINOR_UNITS_PER_MAJOR);
}

export function majorToCents(major: string | number): number {
  const value = typeof major === 'string' ? Number.parseFloat(major) : major;
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot convert "${major}" to cents`);
  }
  return Math.round(value * MINOR_UNITS_PER_MAJOR);
}

export function centsToMajor(cents: number): number {
  return cents / MINOR_UNITS_PER_MAJOR;
}

