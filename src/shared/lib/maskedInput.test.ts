import { describe, expect, it } from 'vitest'
import { applyMask, caretAfterDigits } from './maskedInput'

const phone = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 9)
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)]
    .filter((group) => group.length > 0)
    .join('-')
}

const thousands = (raw: string) => raw.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')

describe('caretAfterDigits', () => {
  it('lands just after the n-th digit, skipping separators', () => {
    expect(caretAfterDigits('99-765-21-34', 0)).toBe(0)
    expect(caretAfterDigits('99-765-21-34', 2)).toBe(2)
    expect(caretAfterDigits('99-765-21-34', 3)).toBe(4)
    expect(caretAfterDigits('99-765-21-34', 99)).toBe(12)
  })
})

describe('applyMask', () => {
  it('keeps the caret where a digit was deleted in the middle', () => {
    // "99-7|65-21-34" with Backspace → "99|-652-13-4": right after the 9s.
    expect(applyMask({ raw: '99-65-21-34', caret: 3, previous: '99-765-21-34' }, phone)).toEqual({
      display: '99-652-13-4',
      caret: 2,
    })
  })

  it('keeps the caret right after a digit typed in the middle', () => {
    // "99-|652-13-4" typing 8 → "99-8|65-21-34"
    expect(applyMask({ raw: '99-8652-13-4', caret: 4, previous: '99-652-13-4' }, phone)).toEqual({
      display: '99-865-21-34',
      caret: 4,
    })
  })

  it('moves the caret past a separator the mask inserts', () => {
    expect(applyMask({ raw: '997', caret: 3, previous: '99' }, phone)).toEqual({
      display: '99-7',
      caret: 4,
    })
  })

  it('deletes the digit before a separator on Backspace instead of doing nothing', () => {
    // "99-|765-21-34" Backspace removes the "-"; the user meant the 9 before it.
    expect(applyMask({ raw: '99765-21-34', caret: 2, previous: '99-765-21-34' }, phone)).toEqual({
      display: '97-652-13-4',
      caret: 1,
    })
  })

  it('keeps every digit of a replacement one character shorter than the old value', () => {
    // "350,000" selected and "100000" pasted over it: not a deleted separator.
    expect(applyMask({ raw: '100000', caret: 6, previous: '350,000' }, thousands)).toEqual({
      display: '100,000',
      caret: 7,
    })
  })

  it('deletes the digit after a separator on Delete', () => {
    expect(
      applyMask(
        {
          raw: '99765-21-34',
          caret: 2,
          previous: '99-765-21-34',
          inputType: 'deleteContentForward',
        },
        phone,
      ),
    ).toEqual({ display: '99-652-13-4', caret: 2 })
  })

  it('refuses a digit typed into a full number rather than dropping the last one', () => {
    expect(applyMask({ raw: '99-1765-21-34', caret: 4, previous: '99-765-21-34' }, phone)).toEqual({
      display: '99-765-21-34',
      caret: 2,
    })
  })

  it('ignores a typed letter without moving the caret', () => {
    expect(applyMask({ raw: '99-7a65', caret: 5, previous: '99-765' }, phone)).toEqual({
      display: '99-765',
      caret: 4,
    })
  })
})
