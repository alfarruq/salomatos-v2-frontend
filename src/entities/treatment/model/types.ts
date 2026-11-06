import type { CalendarDate } from '@/shared/lib/calendarDate'

/**
 * A recorded procedure is either standing or voided. Money is append-only on
 * the server: a mistake is voided with a reason, never edited or deleted.
 */
export type TreatmentStatus = 'done' | 'voided'

/** A tooth surface, FDI convention: mesial, occlusal, distal, buccal, lingual, incisal. */
export type ToothSurface = 'M' | 'O' | 'D' | 'B' | 'L' | 'I'

/** Filters of the clinic-wide journal. Ids only: a patient's name never goes in a URL (§3). */
export interface TreatmentListFilters {
  page: number
  patientId: string | null
  doctorId: string | null
  /** A service id. */
  treatmentTypeId: string | null
  status: TreatmentStatus | null
}

export const defaultTreatmentListFilters: TreatmentListFilters = {
  page: 1,
  patientId: null,
  doctorId: null,
  treatmentTypeId: null,
  status: null,
}

/** One performed procedure (`ProcedureSerializer`) — the slice keeps its old name. */
export interface Treatment {
  id: string
  patientId: string
  patientName: string | null
  doctorId: string | null
  doctorName: string | null
  serviceId: string
  treatmentTypeName: string | null
  /** FDI tooth number. */
  toothNumber: number | null
  surfaces: readonly ToothSurface[]
  quantity: number
  /** So'm, copied from the price list when the procedure was recorded. */
  unitPrice: number
  discountPercent: number
  /** `quantity × unitPrice × (1 − discount)`, as the server computed it. */
  totalTreatmentCost: number
  /** UTC ISO-8601 instant. */
  performedAt: string
  /** `performedAt` on the clinic's calendar. */
  startDate: CalendarDate
  notes: string | null
  status: TreatmentStatus
  voidReason: string | null
}
