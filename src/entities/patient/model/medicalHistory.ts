import * as v from 'valibot'

/** Blank text is "nothing recorded"; DRF sends blank TextFields as "". */
const text = v.pipe(
  v.optional(v.nullable(v.string()), null),
  v.transform((value) => (value === null || value.trim() === '' ? null : value)),
)

/** The wire contract for `MedicalHistorySerializer`. */
export const medicalHistorySchema = v.object({
  allergies: text,
  chronic_conditions: text,
  current_medications: text,
  // Three states on purpose: "not asked" must not read as "not pregnant".
  is_pregnant: v.optional(v.nullable(v.boolean()), null),
  notes: text,
  updated_at: v.optional(v.nullable(v.string()), null),
})

export interface MedicalHistory {
  allergies: string | null
  chronicConditions: string | null
  currentMedications: string | null
  isPregnant: boolean | null
  notes: string | null
  updatedAt: string | null
}

export function toMedicalHistory(raw: v.InferOutput<typeof medicalHistorySchema>): MedicalHistory {
  return {
    allergies: raw.allergies,
    chronicConditions: raw.chronic_conditions,
    currentMedications: raw.current_medications,
    isPregnant: raw.is_pregnant,
    notes: raw.notes,
    updatedAt: raw.updated_at,
  }
}

/** Nothing recorded at all: the card asks for the anamnesis instead of listing dashes. */
export function isMedicalHistoryEmpty(history: MedicalHistory): boolean {
  return (
    history.allergies === null &&
    history.chronicConditions === null &&
    history.currentMedications === null &&
    history.isPregnant === null &&
    history.notes === null
  )
}

export interface MedicalHistoryInput {
  allergies: string
  chronicConditions: string
  currentMedications: string
  /** The radio group needs strings; "unknown" is "not asked". */
  isPregnant: 'unknown' | 'yes' | 'no'
  notes: string
}

export function toMedicalHistoryInput(history: MedicalHistory): MedicalHistoryInput {
  return {
    allergies: history.allergies ?? '',
    chronicConditions: history.chronicConditions ?? '',
    currentMedications: history.currentMedications ?? '',
    isPregnant: history.isPregnant === null ? 'unknown' : history.isPregnant ? 'yes' : 'no',
    notes: history.notes ?? '',
  }
}

export function toMedicalHistoryPayload(input: MedicalHistoryInput) {
  return {
    allergies: input.allergies.trim(),
    chronic_conditions: input.chronicConditions.trim(),
    current_medications: input.currentMedications.trim(),
    is_pregnant: input.isPregnant === 'unknown' ? null : input.isPregnant === 'yes',
    notes: input.notes.trim(),
  }
}
