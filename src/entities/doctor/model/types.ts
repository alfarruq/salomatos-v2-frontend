/** A staff (membership) id — UUID. */
export type DoctorId = string

/**
 * A doctor: a clinic membership with `role='doctor'` (`StaffSerializer`).
 * The id is the membership's, which is what appointments, patients and
 * procedures point at.
 */
export interface Doctor {
  id: DoctorId
  fullName: string
  username: string | null
  phoneNumber: string | null
  email: string | null
  /** A specialty id (`entities/doctor-type`). */
  doctorTypeId: string | null
  doctorTypeName: string | null
  experienceYears: number | null
  isActive: boolean
  currentPay: DoctorPay | null
}

/**
 * The terms in force this month. `null` both when none are set and when the
 * viewer may not see pay: the server leaves the field out for them.
 */
export interface DoctorPay {
  percent: number
  fixed: number
  base: 'collected' | 'billed'
  effectiveFrom: string
}
