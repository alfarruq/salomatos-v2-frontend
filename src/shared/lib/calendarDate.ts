import { dateFormat } from './dateFormat'
/**
 * Calendar dates — a day on a wall calendar, with no time and no zone.
 *
 * §12.4 is strict about timezones because an appointment sliding by an hour is
 * a serious incident. The safest way to handle a *date* is to never let a
 * timezone near it: `new Date('2026-08-21')` parses as UTC midnight, which
 * renders as the 20th anywhere west of Greenwich. So these helpers build and
 * read `Date` objects from local calendar parts only, and the wire format is
 * a plain `yyyy-MM-dd` string.
 *
 * Instants — when an appointment actually starts — are a different type and
 * belong in `datetime.ts` with CLINIC_TZ.
 */

/** `yyyy-MM-dd`. */
export type CalendarDate = string

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toCalendarDate(date: Date): CalendarDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Returns null for anything that is not a real calendar date. */
export function parseCalendarDate(value: string): Date | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))

  // Rejects 2026-02-31, which JavaScript would happily roll into March.
  return toCalendarDate(parsed) === value ? parsed : null
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function todayCalendarDate(): CalendarDate {
  return toCalendarDate(new Date())
}

/**
 * Whole years between `birthDate` and `today`, or null for a date that is not
 * real or lies in the future.
 *
 * Compared as calendar parts, not as milliseconds: a birthday that has not yet
 * come round this year does not count, which is exactly what the server's
 * `now.year - birth_date.year` gets wrong.
 */
export function ageOn(birthDate: CalendarDate, today: CalendarDate): number | null {
  const born = parseCalendarDate(birthDate)
  const now = parseCalendarDate(today)
  if (born === null || now === null || born > now) return null

  const hadBirthday =
    now.getMonth() > born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate())
  return now.getFullYear() - born.getFullYear() - (hadBirthday ? 0 : 1)
}

/**
 * `2026-08-24` → `24 avg 2026`, in the active language.
 *
 * No `timeZone` option, deliberately: the `Date` built by `parseCalendarDate`
 * is local midnight of that calendar day, so `Intl` formats the day that was
 * asked for. Passing a zone here would reintroduce the shift this module
 * exists to prevent.
 *
 * Returns null for a value that is not a real date, so a caller renders
 * nothing rather than "Invalid Date".
 */
export function formatCalendarDate(value: CalendarDate, locale: string): string | null {
  const parsed = parseCalendarDate(value)
  if (parsed === null) return null

  return dateFormat(locale, { dateStyle: 'medium' }).format(parsed)
}

/**
 * `dd.MM.yyyy`, the same in every language — for the dense lists and printed
 * forms that ask for one fixed shape rather than `formatCalendarDate`'s
 * locale-aware one.
 */
export function formatFixedDate(value: CalendarDate): string {
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

/**
 * Monday through Sunday of the week containing `reference` — matches the
 * board's Monday-first columns. Falls back to today on a bad date.
 */
export function weekDatesOf(reference: CalendarDate): CalendarDate[] {
  const parsed = parseCalendarDate(reference) ?? new Date()
  // `getDay()` is 0 for Sunday; shift so Monday is the start of the week.
  const mondayOffset = (parsed.getDay() + 6) % 7
  const monday = new Date(parsed)
  monday.setDate(parsed.getDate() - mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return toCalendarDate(day)
  })
}

/** `dd/mm/yyyy` — how people type a date they know by heart, like a birthday. */
const TYPED_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** Reads a typed `dd/mm/yyyy`, or null when it is incomplete or not a real date. */
export function parseTypedDate(value: string): CalendarDate | null {
  const match = TYPED_DATE.exec(value)
  if (!match) return null

  const [, day, month, year] = match
  const date = `${year}-${month}-${day}`
  return parseCalendarDate(date) === null ? null : date
}

/** The inverse of `parseTypedDate`; empty for anything that is not a real date. */
export function toTypedDate(date: CalendarDate): string {
  const match = ISO_DATE.exec(date)
  if (!match || parseCalendarDate(date) === null) return ''

  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}
