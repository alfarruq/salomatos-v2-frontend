import { type CalendarDate, parseCalendarDate, toCalendarDate } from './calendarDate'

/**
 * Shared by the statistics and finance reports: the same period presets,
 * buckets and labels, so the two sections read alike.
 *
 * A preset window ending today (clinic time). Presets rather than free dates
 * for the MVP: they are what a clinic owner reaches for, and each one has an
 * obvious bucket size for its chart.
 */
export const REPORT_PERIODS = ['week', 'month', 'quarter', 'year'] as const

export type ReportPeriod = (typeof REPORT_PERIODS)[number]

export type ReportBucket = 'day' | 'week' | 'month'

export interface ReportRange {
  from: CalendarDate
  to: CalendarDate
  bucket: ReportBucket
}

const PERIOD_SHAPE: Record<ReportPeriod, { days: number; bucket: ReportBucket }> = {
  week: { days: 7, bucket: 'day' },
  month: { days: 30, bucket: 'day' },
  quarter: { days: 91, bucket: 'week' },
  year: { days: 365, bucket: 'month' },
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const parsed = parseCalendarDate(date)
  if (parsed === null) throw new Error(`Not a calendar date: ${date}`)
  parsed.setDate(parsed.getDate() + days)
  return toCalendarDate(parsed)
}

/**
 * The window a preset covers, ending on `today` inclusive. `today` is passed
 * in, not read here: it must be the clinic's day (§14), which the caller owns.
 */
export function rangeOf(period: ReportPeriod, today: CalendarDate): ReportRange {
  const { days, bucket } = PERIOD_SHAPE[period]
  return { from: addDays(today, -(days - 1)), to: today, bucket }
}

/** Signed percentage change, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/** Share as a whole percentage; 0 for an empty denominator rather than NaN. */
export function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100)
}

/**
 * Axis label for a bucket's first day. A calendar date has no zone of its own,
 * so it is formatted as the local date it parses to — no `timeZone` here.
 */
export function bucketLabel(start: string, bucket: ReportBucket, locale: string): string {
  const date = parseCalendarDate(start)
  if (date === null) return start
  const options: Intl.DateTimeFormatOptions =
    bucket === 'month' ? { month: 'short' } : { day: 'numeric', month: 'short' }
  return new Intl.DateTimeFormat(locale, options).format(date)
}

/** A known Monday, so ISO weekday n is that date plus n − 1 days. */
const REFERENCE_MONDAY = '2024-01-01'

export function weekdayLabel(isoWeekday: number, locale: string): string {
  const date = parseCalendarDate(addDays(REFERENCE_MONDAY, isoWeekday - 1))
  return date === null
    ? String(isoWeekday)
    : new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
}
