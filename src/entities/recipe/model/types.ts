/** One line of a prescription (`PrescriptionItemSerializer`). */
export interface Medicine {
  id: string
  name: string | null
  /** How many units per intake, when the dose is a plain count. */
  dose: number | null
  /** A `DoseForm` code, or an older row's own words. */
  type: string | null
  /** A `Frequency` code derived from times per day, or null when it has none. */
  frequency: string | null
  timesPerDay: number | null
  /** Days. */
  duration: number | null
  /** A `MealRelation` code. */
  meal: string | null
  instructions: string | null
}

export interface Recipe {
  id: string
  /** The prescribing doctor's membership id; the editor starts from it. */
  doctorId: string | null
  doctorName: string | null
  notes: string | null
  clinicName: string | null
  createdAt: string | null
  medicines: readonly Medicine[]
}
