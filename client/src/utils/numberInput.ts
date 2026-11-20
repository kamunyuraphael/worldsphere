/**
 * Small helpers for turning free-form form input into safe numbers.
 * Money is always stored as integer minor units (cents) to avoid float drift.
 */

/** Parse "12.50" into 1250. Blank, negative or non-numeric input becomes 0. */
export const toMinorUnits = (raw: string): number => {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
};

/** Format 1250 as "12.5"; zero becomes '' so the field can show a placeholder. */
export const fromMinorUnits = (minor: number): string => (minor > 0 ? String(minor / 100) : '');

/** Parse an integer and clamp it into [min, max]. Non-numeric input returns `fallback`. */
export const toBoundedInt = (raw: string, min: number, max: number, fallback = min): number => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};
