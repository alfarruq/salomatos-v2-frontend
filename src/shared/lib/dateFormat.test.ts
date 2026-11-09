import { describe, expect, it } from 'vitest'
import { dateFormat, formatUzbek } from './dateFormat'

const INSTANT = Date.UTC(2026, 10, 9, 9, 30) // 14:30 in Tashkent, a Monday
const TZ = 'Asia/Tashkent'

const SHAPES = [
  { dateStyle: 'medium' },
  { dateStyle: 'medium', timeStyle: 'short' },
  { timeStyle: 'short' },
  { weekday: 'long', day: 'numeric', month: 'long' },
  { month: 'long', year: 'numeric' },
  { month: 'short' },
  { day: 'numeric', month: 'short' },
  { weekday: 'short' },
] as const

describe('the Uzbek fallback', () => {
  // Node has full ICU, so real Intl output is the reference the fallback must match.
  it.each(SHAPES)('matches CLDR Latin for %j', (shape) => {
    const options = { ...shape, timeZone: TZ }
    const reference = new Intl.DateTimeFormat('uz-Latn', options).format(INSTANT)
    expect(formatUzbek('latn', options, INSTANT).toLowerCase()).toBe(reference.toLowerCase())
  })

  it.each(SHAPES)('matches CLDR Cyrillic for %j', (shape) => {
    const options = { ...shape, timeZone: TZ }
    const reference = new Intl.DateTimeFormat('uz-Cyrl', options).format(INSTANT)
    expect(formatUzbek('cyrl', options, INSTANT)).toBe(reference)
  })

  it('reads the day in the given zone, not UTC', () => {
    const lateEvening = Date.UTC(2026, 10, 9, 20, 0) // 01:00 on the 10th in Tashkent
    expect(formatUzbek('latn', { dateStyle: 'medium', timeZone: TZ }, lateEvening)).toBe(
      '10-noy, 2026',
    )
  })
})

describe('dateFormat', () => {
  it('uses Intl where the engine has the data', () => {
    expect(dateFormat('uz-Latn', { month: 'long', timeZone: TZ }).format(INSTANT)).toBe(
      new Intl.DateTimeFormat('uz-Latn', { month: 'long', timeZone: TZ }).format(INSTANT),
    )
    expect(dateFormat('ru', { month: 'long', timeZone: TZ }).format(INSTANT)).toBe('ноябрь')
  })
})
