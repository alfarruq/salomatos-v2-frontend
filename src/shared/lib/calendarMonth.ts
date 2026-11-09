import { parseCalendarDate } from './calendarDate'
import { dateFormat } from './dateFormat'
import { clinicNow } from './datetime'

/** `yyyy-MM`: a month on a wall calendar, with no zone — see `calendarDate.ts`. */
export type CalendarMonth = string

export const CALENDAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** The clinic's month (§14), not the browser's. */
export function currentMonth(): CalendarMonth {
  return clinicNow().date.slice(0, 7)
}

export function shiftMonth(month: CalendarMonth, delta: number): CalendarMonth {
  const [year = 0, index = 1] = month.split('-').map(Number)
  const total = year * 12 + (index - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function monthLabel(month: CalendarMonth, locale: string): string {
  const date = parseCalendarDate(`${month}-01`)
  return date === null ? month : dateFormat(locale, { month: 'long', year: 'numeric' }).format(date)
}
