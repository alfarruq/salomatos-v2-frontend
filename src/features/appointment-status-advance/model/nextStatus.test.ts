import { describe, expect, it } from 'vitest'
import { nextStatusOf } from './nextStatus'

describe('nextStatusOf', () => {
  it('marks a booked visit as arrived, then an arrived one as done', () => {
    expect(nextStatusOf('scheduled')).toBe('arrived')
    expect(nextStatusOf('confirmed')).toBe('arrived')
    expect(nextStatusOf('arrived')).toBe('completed')
    expect(nextStatusOf('in_chair')).toBe('completed')
  })

  it('offers nothing once the visit is over', () => {
    expect(nextStatusOf('completed')).toBeNull()
    expect(nextStatusOf('no_show')).toBeNull()
    expect(nextStatusOf('cancelled')).toBeNull()
  })
})
