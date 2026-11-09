/**
 * `Intl.DateTimeFormat`, with a fallback for Uzbek.
 *
 * Chromium-based browsers (Chrome, Edge) ship ICU without Uzbek date data: they
 * report `uz` as supported and then format with the root locale, giving
 * "M11 9, Mon". Safari and Firefox have the data and keep using `Intl`. The
 * fallback reproduces CLDR's Uzbek patterns for the option shapes this app
 * uses, from numbers `Intl` still computes correctly (including the zone).
 */

export type Script = 'latn' | 'cyrl'

const NAMES: Record<
  Script,
  { months: string[]; monthsShort: string[]; weekdays: string[]; weekdaysShort: string[] }
> = {
  latn: {
    months: [
      'yanvar',
      'fevral',
      'mart',
      'aprel',
      'may',
      'iyun',
      'iyul',
      'avgust',
      'sentabr',
      'oktabr',
      'noyabr',
      'dekabr',
    ],
    monthsShort: [
      'yan',
      'fev',
      'mar',
      'apr',
      'may',
      'iyn',
      'iyl',
      'avg',
      'sen',
      'okt',
      'noy',
      'dek',
    ],
    weekdays: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
    weekdaysShort: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'],
  },
  cyrl: {
    months: [
      'январ',
      'феврал',
      'март',
      'апрел',
      'май',
      'июн',
      'июл',
      'август',
      'сентябр',
      'октябр',
      'ноябр',
      'декабр',
    ],
    monthsShort: [
      'янв',
      'фев',
      'мар',
      'апр',
      'май',
      'июн',
      'июл',
      'авг',
      'сен',
      'окт',
      'ноя',
      'дек',
    ],
    weekdays: ['якшанба', 'душанба', 'сешанба', 'чоршанба', 'пайшанба', 'жума', 'шанба'],
    weekdaysShort: ['якш', 'душ', 'сеш', 'чор', 'пай', 'жум', 'шан'],
  },
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const missingData = new Map<string, boolean>()

function uzbekScript(locale: string): Script | null {
  const tag = locale.toLowerCase()
  if (tag !== 'uz' && !tag.startsWith('uz-')) return null
  return tag.includes('cyrl') ? 'cyrl' : 'latn'
}

/** True when this engine formats `locale` with root data ("M01") instead of real month names. */
function lacksDateData(locale: string): boolean {
  let missing = missingData.get(locale)
  if (missing === undefined) {
    const sample = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      Date.UTC(2024, 0, 15),
    )
    missing = /^M\d/.test(sample)
    missingData.set(locale, missing)
  }
  return missing
}

interface Parts {
  year: number
  month: number
  day: number
  weekday: number
  time: string
}

function partsOf(date: Date | number, timeZone: string | undefined): Parts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone === undefined ? {} : { timeZone }),
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return {
    year: Number(part('year')),
    month: Number(part('month')),
    day: Number(part('day')),
    weekday: WEEKDAY_INDEX[part('weekday')] ?? 0,
    time: `${part('hour')}:${part('minute')}`,
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Exported for tests: the engine running them has the data `dateFormat` checks for. */
export function formatUzbek(
  script: Script,
  options: Intl.DateTimeFormatOptions,
  date: Date | number,
): string {
  const names = NAMES[script]
  const p = partsOf(date, options.timeZone)
  // Latin writes "9-noyabr", Cyrillic "9 ноябр".
  const dayMonth = (month: string) =>
    script === 'latn' ? `${p.day}-${month}` : `${p.day} ${month}`
  const monthShort = names.monthsShort[p.month - 1] ?? ''
  const monthLong = names.months[p.month - 1] ?? ''

  if (options.dateStyle !== undefined || options.timeStyle !== undefined) {
    const datePart = options.dateStyle === undefined ? null : `${dayMonth(monthShort)}, ${p.year}`
    const timePart = options.timeStyle === undefined ? null : p.time
    if (datePart === null) return timePart ?? ''
    if (timePart === null) return datePart
    return script === 'latn' ? `${datePart}, ${timePart}` : `${datePart} ${timePart}`
  }

  const month =
    options.month === 'long' ? monthLong : options.month === undefined ? null : monthShort
  let text: string | null = null
  if (month !== null && options.day !== undefined) text = dayMonth(month)
  else if (month !== null)
    text = options.year === undefined && script === 'latn' ? capitalize(month) : month
  else if (options.day !== undefined) text = String(p.day)
  if (options.year !== undefined) text = text === null ? String(p.year) : `${text}, ${p.year}`
  if (options.hour !== undefined || options.minute !== undefined) {
    text = text === null ? p.time : `${text}, ${p.time}`
  }
  if (options.weekday !== undefined) {
    const weekday =
      options.weekday === 'long' ? names.weekdays[p.weekday] : names.weekdaysShort[p.weekday]
    text = text === null ? (weekday ?? '') : `${weekday}, ${text}`
  }
  return text ?? ''
}

export interface DateFormat {
  format(date: Date | number): string
}

/** Use instead of `new Intl.DateTimeFormat(locale, options)` for anything a person reads. */
export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions = {}): DateFormat {
  const script = uzbekScript(locale)
  if (script !== null && lacksDateData(locale)) {
    return { format: (date) => formatUzbek(script, options, date) }
  }
  return new Intl.DateTimeFormat(locale, options)
}
