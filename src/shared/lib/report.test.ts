import { describe, expect, it } from 'vitest'
import { bucketLabel, percentChange, percentOf, rangeOf, weekdayLabel } from './report'

describe('percentChange', () => {
  it('rounds the signed change', () => {
    expect(percentChange(120, 100)).toBe(20)
    expect(percentChange(90, 100)).toBe(-10)
  })

  it('has nothing to say without a baseline', () => {
    expect(percentChange(5, null)).toBeNull()
    expect(percentChange(5, 0)).toBeNull()
  })
})

describe('percentOf', () => {
  it('does not divide by zero', () => {
    expect(percentOf(3, 0)).toBe(0)
    expect(percentOf(1, 3)).toBe(33)
  })
})

describe('labels', () => {
  it('formats buckets and weekdays in the given locale', () => {
    expect(bucketLabel('2026-10-19', 'day', 'en')).toBe('Oct 19')
    expect(bucketLabel('2026-10-01', 'month', 'en')).toBe('Oct')
    expect(weekdayLabel(1, 'en')).toBe('Mon')
    expect(weekdayLabel(7, 'en')).toBe('Sun')
  })
})

describe('rangeOf', () => {
  it('ends on the given day and counts it in', () => {
    expect(rangeOf('week', '2026-10-19')).toEqual({
      from: '2026-10-13',
      to: '2026-10-19',
      bucket: 'day',
    })
    expect(rangeOf('year', '2026-10-19')).toMatchObject({ from: '2025-10-20', bucket: 'month' })
  })
})
