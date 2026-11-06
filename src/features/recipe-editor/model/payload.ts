import { FREQUENCIES, type Frequency } from '@/entities/recipe'
import type { CatalogMedicine } from './catalog'
import type { MedicineRow } from './types'

/** `POST /api/v1/prescriptions/` — every item field the serializer requires is always sent. */
/** `PrescriptionItemSerializer`'s writable fields. */
export interface MedicinePayload {
  medicine: string
  dose: string
  form: string
  times_per_day: number
  duration_days: number
  meal_relation: string
  instructions: string
}

export interface RecipePayload {
  patient: string
  doctor: string
  notes: string
  items: MedicinePayload[]
}

function timesPerDay(frequency: Frequency): number {
  return FREQUENCIES.indexOf(frequency) + 1
}

const DAYS_PER_WEEK = 7

let rowIdCounter = 0
function nextRowId(): string {
  rowIdCounter += 1
  return `medicine-${rowIdCounter}`
}

/** What "Dori qo'shish" opens with: the most common dental course. */
export function newMedicineRow(): MedicineRow {
  return {
    rowId: nextRowId(),
    name: '',
    dose: '1',
    form: 'tablet',
    frequency: 'bid',
    meal: 'after',
    durationAmount: '5',
    durationUnit: 'days',
  }
}

/** Picking from the catalog fills the whole row, keeping only its identity. */
export function fillFromCatalog(row: MedicineRow, medicine: CatalogMedicine): MedicineRow {
  return {
    rowId: row.rowId,
    name: medicine.name,
    dose: String(medicine.dose),
    form: medicine.form,
    frequency: medicine.frequency,
    meal: medicine.meal,
    durationAmount: String(medicine.durationAmount),
    durationUnit: medicine.durationUnit,
  }
}

/** The server only takes integers; anything else is refused before it is sent. */
function parseInteger(value: string, min: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return parsed >= min ? parsed : null
}

/**
 * Null when the row cannot be saved as written. A dose or duration is never
 * guessed: a prescription that silently became "1 for 1 day" is worse than
 * one the doctor is asked to finish.
 */
export function toMedicinePayload(row: MedicineRow): MedicinePayload | null {
  const name = row.name.trim()
  const dose = parseInteger(row.dose, 1)
  const amount = parseInteger(row.durationAmount, 1)
  if (name === '' || dose === null || amount === null) return null

  return {
    medicine: name,
    dose: String(dose),
    form: row.form,
    times_per_day: timesPerDay(row.frequency),
    // The server counts days; a course in weeks is stored as days.
    duration_days: row.durationUnit === 'weeks' ? amount * DAYS_PER_WEEK : amount,
    // "Regardless of food" is `any` on the server.
    meal_relation: row.meal === 'none' ? 'any' : row.meal,
    instructions: '',
  }
}

export function isRowComplete(row: MedicineRow): boolean {
  return toMedicinePayload(row) !== null
}

export function toRecipePayload(input: {
  patientId: string
  doctorId: string
  notes: string
  rows: MedicineRow[]
}): RecipePayload {
  return {
    patient: input.patientId,
    doctor: input.doctorId,
    notes: input.notes.trim(),
    items: input.rows.map(toMedicinePayload).filter((payload) => payload !== null),
  }
}
