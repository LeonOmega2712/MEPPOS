/**
 * Computes local business-day boundaries for daily consecutive counters
 * (orders.bar_position, orders.takeout_number).
 *
 * The restaurant timezone is currently hardcoded to America/Mexico_City.
 * Follow-up: https://github.com/LeonOmega2712/MEPPOS/issues/65 tracks making
 * this configurable via app settings.
 */
const RESTAURANT_TIMEZONE = 'America/Mexico_City';

/**
 * Returns the UTC instant corresponding to 00:00:00 local time (in
 * RESTAURANT_TIMEZONE) for the local calendar day containing `date`.
 */
export function startOfBusinessDay(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: RESTAURANT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    // `hour12: false` is not equivalent to 24h time: per ECMA-402 it lets the
    // runtime pick a locale-dependent hourCycle, which on older ICU (e.g.
    // Node 20) resolves to 'h24' and reports midnight as hour 24 instead of
    // 0. Requesting 'h23' explicitly avoids that runtime-dependent behavior.
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  // Build the local wall-clock time as if it were UTC, then compute the
  // offset between that and the real UTC instant to find the timezone's
  // offset at `date`. Note: this offset is assumed constant through
  // midnight, which is incorrect on the day of a DST transition. Not an
  // issue today since America/Mexico_City has not observed DST since 2022,
  // but must be revisited if issue #65 (configurable timezone) picks one
  // that does.
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMs = asUtc - date.getTime();

  // Midnight local time expressed as a UTC instant.
  const localMidnightAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), 0, 0, 0);
  return new Date(localMidnightAsUtc - offsetMs);
}
