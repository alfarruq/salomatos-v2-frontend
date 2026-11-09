import { dateFormat } from './dateFormat'

/**
 * Instants — a moment in time, as opposed to a calendar date.
 *
 * §12.4's rules, and the reason for each:
 *
 *   The backend always sends UTC ISO-8601. One source of truth.
 *   Conversion happens only at display time. Business logic stays in UTC.
 *   Formatting is `Intl` through `dateFormat`, which only fills in Uzbek
 *   where the browser lacks the data. Every language formats differently.
 *   The zone is the clinic's, not the browser's — staff travel, clinics do not.
 *
 * An appointment sliding by an hour is a serious incident in a medical system,
 * which is why none of this is left to the caller to remember.
 *
 * For a *date* with no time — a birth date, a report range — use
 * `calendarDate.ts`, which keeps timezones out of the question entirely.
 */

/**
 * ADR-010: a constant, because Uzbekistan is a single zone (UTC+5) with no
 * daylight saving. When clinics span zones this becomes a field on the clinic,
 * and only this module changes — which is the point of it being here.
 */
export const CLINIC_TZ = 'Asia/Tashkent'

/** Rejects a value the backend should never have sent, rather than rendering "Invalid Date". */
function parseInstant(utcIso: string): Date {
  const parsed = new Date(utcIso)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO-8601 instant: ${utcIso}`)
  }
  return parsed
}

export interface FormatOptions {
  /** BCP-47 tag, from the active i18n language. */
  locale: string
  /** Override the clinic zone. Almost never right — see the module comment. */
  timeZone?: string
}

/** `21 avg 2026, 14:30` — the default for anything on a schedule. */
export function formatDateTime(utcIso: string, { locale, timeZone }: FormatOptions): string {
  return dateFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timeZone ?? CLINIC_TZ,
  }).format(parseInstant(utcIso))
}

/** `21 avg 2026` — when the time of day is not the point. */
export function formatDate(utcIso: string, { locale, timeZone }: FormatOptions): string {
  return dateFormat(locale, {
    dateStyle: 'medium',
    timeZone: timeZone ?? CLINIC_TZ,
  }).format(parseInstant(utcIso))
}

/** `14:30` — for a column of appointment times, where the date is a heading. */
export function formatTime(utcIso: string, { locale, timeZone }: FormatOptions): string {
  return dateFormat(locale, {
    timeStyle: 'short',
    timeZone: timeZone ?? CLINIC_TZ,
  }).format(parseInstant(utcIso))
}

/**
 * The clinic's calendar day for an instant, as `yyyy-MM-dd`.
 *
 * Not `toISOString().slice(0, 10)`: that is the *UTC* day, and an appointment
 * at 02:00 Tashkent belongs to a day that UTC still calls yesterday.
 */
export function clinicDayOf(utcIso: string, timeZone: string = CLINIC_TZ): string {
  // `en-CA` because its short date format is exactly ISO order.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(parseInstant(utcIso))
}

/**
 * The clinic's wall clock right now: its calendar day (`yyyy-MM-dd`) and time
 * (`HH:mm`). The browser's own clock and zone are both the wrong answer for
 * "what is next today" on a laptop that travelled or was set by hand.
 */
export function clinicNow(
  now: Date = new Date(),
  timeZone: string = CLINIC_TZ,
): { date: string; time: string } {
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(now)
  return { date: clinicDayOf(now.toISOString(), timeZone), time }
}

/** Milliseconds the zone's wall clock is ahead of UTC at `instant`. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(new Date(instant))
  const part = (type: string) => Number(parts.find((candidate) => candidate.type === type)?.value)
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  )
  return wall - Math.floor(instant / 1000) * 1000
}

/**
 * The UTC instant of a wall-clock time in the clinic, as ISO-8601 — the inverse
 * of `clinicDayOf` + `clinicTimeOf`. The backend stores instants; staff type a
 * day and an hour on the clinic's clock, not the browser's.
 */
export function clinicInstantOf(date: string, time: string, timeZone: string = CLINIC_TZ): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wall = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0)
  // Twice, so a wall time near a DST change settles on the offset in force then.
  let instant = wall - zoneOffsetMs(wall, timeZone)
  instant = wall - zoneOffsetMs(instant, timeZone)
  return new Date(instant).toISOString()
}

/** The clinic's wall-clock `HH:mm` for an instant. */
export function clinicTimeOf(utcIso: string, timeZone: string = CLINIC_TZ): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(parseInstant(utcIso))
}
