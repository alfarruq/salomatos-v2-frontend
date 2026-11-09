import type { DoseForm, DurationUnit, Frequency, MealRelation } from '@/entities/recipe'

/**
 * One medicine as the editor holds it. Numbers stay strings while the user
 * types — an emptied input is "" here, not a silent 0 that would be saved.
 */
export interface MedicineRow {
  rowId: string
  name: string
  dose: string
  form: DoseForm
  frequency: Frequency
  meal: MealRelation
  durationAmount: string
  durationUnit: DurationUnit
  /** Kept from a saved item; the editor has no field for it, so an edit must not wipe it. */
  instructions?: string
}
