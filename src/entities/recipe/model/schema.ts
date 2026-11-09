import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import { FREQUENCIES } from './medication'
import type { Medicine, Recipe } from './types'

const optionalText = v.pipe(
  v.optional(v.nullable(v.string()), null),
  v.transform((value) => (value === null || value === '' ? null : value)),
)

const medicineSchema = v.object({
  id: v.string(),
  medicine: optionalText,
  dose: optionalText,
  form: optionalText,
  times_per_day: v.optional(v.nullable(v.number()), null),
  duration_days: v.optional(v.nullable(v.number()), null),
  meal_relation: optionalText,
  instructions: optionalText,
})

/** `PrescriptionSerializer`, validated at runtime (ADR-006). */
export const recipeSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  doctor: optionalText,
  doctor_name: optionalText,
  notes: optionalText,
  clinic_name: optionalText,
  created_at: optionalText,
  items: v.optional(v.fallback(v.array(medicineSchema), []), []),
})

export const recipePageSchema = pageSchema(recipeSchema)

export type RecipeResponse = v.InferOutput<typeof recipeSchema>

/** The server says "any time"; the editor's code for the same thing is `none`. */
function toMeal(value: string | null): string | null {
  return value === 'any' ? 'none' : value
}

function toMedicine(response: v.InferOutput<typeof medicineSchema>): Medicine {
  const dose = response.dose !== null && /^\d+$/.test(response.dose) ? Number(response.dose) : null
  const times = response.times_per_day
  return {
    id: response.id,
    name: response.medicine,
    dose,
    // A dose that is not a plain count ("400 mg") is kept as words beside the form.
    type:
      dose === null
        ? [response.dose, response.form].filter((part) => part !== null).join(' ') || null
        : response.form,
    frequency:
      times !== null && times >= 1 && times <= FREQUENCIES.length
        ? (FREQUENCIES[times - 1] ?? null)
        : null,
    timesPerDay: times,
    duration: response.duration_days,
    meal: toMeal(response.meal_relation),
    instructions: response.instructions,
  }
}

export function toRecipe(response: RecipeResponse): Recipe {
  return {
    id: response.id,
    doctorId: response.doctor,
    doctorName: response.doctor_name,
    notes: response.notes,
    clinicName: response.clinic_name,
    createdAt: response.created_at,
    medicines: response.items.map(toMedicine),
  }
}
