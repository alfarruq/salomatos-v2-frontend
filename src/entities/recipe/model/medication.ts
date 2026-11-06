/**
 * The codes this client writes into a medicine's free-text `type`,
 * `frequency` and `meal` fields. Codes rather than words, so a prescription
 * written in one interface language reads correctly in the other three; the
 * label comes from the `recipes` namespace at display time.
 */
export const DOSE_FORMS = [
  'tablet',
  'capsule',
  'sachet',
  'gel',
  'spray',
  'drops',
  'injection',
  'cream',
  // Not in the original brief, but half the dental "topical" list is a mouth rinse.
  'rinse',
] as const
export type DoseForm = (typeof DOSE_FORMS)[number]

export const FREQUENCIES = ['od', 'bid', 'tid', 'qid'] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const MEAL_RELATIONS = ['before', 'after', 'with', 'none'] as const
export type MealRelation = (typeof MEAL_RELATIONS)[number]

export const DURATION_UNITS = ['days', 'weeks'] as const
export type DurationUnit = (typeof DURATION_UNITS)[number]

function isOneOf<T extends string>(values: readonly T[], value: string | null): value is T {
  return value !== null && (values as readonly string[]).includes(value)
}

export const isDoseForm = (value: string | null) => isOneOf(DOSE_FORMS, value)
export const isFrequency = (value: string | null) => isOneOf(FREQUENCIES, value)
export const isMealRelation = (value: string | null) => isOneOf(MEAL_RELATIONS, value)
