import { isDoseForm, isFrequency, isMealRelation } from './medication'
import type { Medicine } from './types'

/** The `t` this needs — narrow on purpose, so tests can pass a stand-in. */
export type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * Screen wording for one medicine. Each part reads a code through `t`, and
 * anything that is not a known code — an older row's own words — is shown as
 * it was stored rather than dropped.
 */
export function formatDosage(medicine: Medicine, t: Translate): string {
  const { dose, type } = medicine
  if (dose === null) return type ?? ''
  if (isDoseForm(type)) return t(`recipes:doseForm.${type}`, { count: dose })
  return [String(dose), type].filter(Boolean).join(' ')
}

export function formatSchedule(medicine: Medicine, t: Translate): string {
  const frequency = isFrequency(medicine.frequency)
    ? t(`recipes:frequency.${medicine.frequency}`)
    : medicine.frequency

  return [frequency, formatMeal(medicine, t)].filter(Boolean).join(' · ')
}

function formatMeal({ meal }: Medicine, t: Translate): string | null {
  if (!isMealRelation(meal)) return meal
  if (meal === 'none') return null
  return t(`recipes:meal.${meal}`)
}

/** Days only: the server's `duration` is an integer with no unit beside it. */
export function formatDuration(medicine: Medicine, t: Translate): string {
  return medicine.duration === null ? '' : t('recipes:duration.days', { count: medicine.duration })
}
