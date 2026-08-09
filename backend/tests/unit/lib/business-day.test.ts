import { describe, it, expect } from 'vitest';
import { startOfBusinessDay } from '../../../src/lib/business-day';

// America/Mexico_City has used a fixed UTC-6 offset (no DST) since 2022,
// which makes these boundaries deterministic to compute by hand.

describe('startOfBusinessDay', () => {
  it('returns local midnight for a time late in the local evening', () => {
    // 2026-07-04 21:30 CST (UTC-6) == 2026-07-05 03:30 UTC
    const result = startOfBusinessDay(new Date('2026-07-05T03:30:00.000Z'));

    // Local midnight for 2026-07-04 CST == 2026-07-04T06:00:00.000Z
    expect(result.toISOString()).toBe('2026-07-04T06:00:00.000Z');
  });

  it('returns the same instant when already exactly at local midnight', () => {
    const result = startOfBusinessDay(new Date('2026-07-05T06:00:00.000Z'));

    expect(result.toISOString()).toBe('2026-07-05T06:00:00.000Z');
  });

  it('rolls over to the next local day just after midnight', () => {
    const result = startOfBusinessDay(new Date('2026-07-05T06:00:01.000Z'));

    expect(result.toISOString()).toBe('2026-07-05T06:00:00.000Z');
  });
});
