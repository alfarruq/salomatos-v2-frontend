import { describe, expect, it } from 'vitest'
import { formatDosage, formatDuration, formatSchedule, type Translate } from './format'
import type { Medicine } from './types'

/** Echoes the key and options, so the tests pin which key was chosen, not the wording. */
const t: Translate = (key, options) =>
  options === undefined ? key : `${key}${JSON.stringify(options)}`

const coded: Medicine = {
  id: 'item-1',
  name: 'Amoksiklav 625 mg',
  dose: 1,
  type: 'tablet',
  frequency: 'bid',
  timesPerDay: 2,
  duration: 5,
  meal: 'after',
  instructions: null,
}

describe('formatDosage', () => {
  it('translates a known dose form, counted for plurals', () => {
    expect(formatDosage(coded, t)).toBe('recipes:doseForm.tablet{"count":1}')
  })

  it("shows an older row's own words when the form is not a code", () => {
    expect(formatDosage({ ...coded, type: 'Tabletka' }, t)).toBe('1 Tabletka')
  })
})

describe('formatSchedule', () => {
  it('joins frequency and the meal relation', () => {
    expect(formatSchedule(coded, t)).toBe('recipes:frequency.bid · recipes:meal.after')
  })

  it('says nothing about food when the timing does not depend on it', () => {
    expect(formatSchedule({ ...coded, meal: 'none' }, t)).toBe('recipes:frequency.bid')
  })

  it('passes free text through untouched', () => {
    expect(
      formatSchedule({ ...coded, frequency: 'Kuniga 2 marta', meal: 'Ovqatdan keyin' }, t),
    ).toBe('Kuniga 2 marta · Ovqatdan keyin')
  })
})

describe('formatDuration', () => {
  it('counts the integer as days', () => {
    expect(formatDuration(coded, t)).toBe('recipes:duration.days{"count":5}')
  })

  it('is empty when the server sent none', () => {
    expect(formatDuration({ ...coded, duration: null }, t)).toBe('')
  })
})
