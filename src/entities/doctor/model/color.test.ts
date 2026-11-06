import { describe, expect, it } from 'vitest'
import { mockId } from '@/shared/api/mocks/fixtures'
import { doctorColorOf } from './color'

describe('doctorColorOf', () => {
  it('gives the same doctor the same colour every time', () => {
    expect(doctorColorOf(mockId(4, 4))).toEqual(doctorColorOf(mockId(4, 4)))
  })

  it('tells neighbouring doctors apart', () => {
    expect(doctorColorOf(mockId(4, 4)).dot).not.toBe(doctorColorOf(mockId(4, 5)).dot)
  })

  it('falls back to a neutral dot when no doctor is assigned', () => {
    expect(doctorColorOf(null).dot).toBe('bg-border-strong')
  })
})
