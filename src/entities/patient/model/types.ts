import type { CalendarDate } from '@/shared/lib/calendarDate'

/** UUID — the backend never exposes sequential ids. */
export type PatientId = string

/** Patients are never deleted; an archived one is hidden from lists and can be restored. */
export type PatientStatus = 'active' | 'archived'

/** `PatientSerializer`. The list and the detail endpoint send the same shape. */
export interface Patient {
  id: PatientId
  clinicId: string
  /** Shown in the owner's all-branches view, where rows from several branches mix. */
  clinicName: string
  fullName: string
  phoneNumber: string | null
  birthDate: CalendarDate | null
  workplace: string | null
  address: string | null
  notes: string | null
  /** A staff (membership) id. */
  primaryDoctorId: string | null
  primaryDoctorName: string | null
  status: PatientStatus
  /** UTC ISO-8601 instant; format at display time (§14). */
  createdAt: string | null
  /**
   * Only booked a visit (name and phone). Kept out of the patient list; the
   * full patient form is filled at the first procedure, which registers them.
   */
  isLead: boolean
  /** Charged minus paid, in so'm; negative is credit. Null when the caller may not see money. */
  debt: number | null
}

/** Kept as an alias so the table's row type reads as what it is. */
export type PatientListItem = Patient

/**
 * What the list asks for.
 *
 * ⛔ `search` is PHI. It belongs in the query key, so two searches are cached
 * apart, but it never reaches a URL: a non-empty search is sent as the body of
 * `POST patients/search/`, and only the non-PHI filters go in the query string.
 */
export interface PatientFilters {
  search: string
  /** A doctor's staff id. */
  doctorId: string | null
  archived: boolean
  /** Also find people who only booked a visit — the booking dialog's search, not the patient list. */
  includeLeads?: boolean
  page: number
}

export const defaultPatientFilters: PatientFilters = {
  search: '',
  doctorId: null,
  archived: false,
  page: 1,
}
