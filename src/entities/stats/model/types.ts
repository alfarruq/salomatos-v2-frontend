import type { CalendarDate } from '@/shared/lib/calendarDate'
import type { ReportRange } from '@/shared/lib/report'

export type {
  ReportBucket as StatsBucket,
  ReportPeriod as StatsPeriod,
  ReportRange as StatsRange,
} from '@/shared/lib/report'
/** The statistics names for the shared report period types (`shared/lib/report`). */
export { REPORT_PERIODS as STATS_PERIODS } from '@/shared/lib/report'

/** Counts only — no names, phones or money: statistics carries no PHI (finance is its own section). */
export interface StatsTotals {
  /** Booked in the period, cancelled ones apart: they never held the chair. */
  appointments: number
  appointmentsCompleted: number
  noShows: number
  cancellations: number
  newPatients: number
  /** Registered before the period and seen in it. */
  returningPatients: number
  /** Procedures performed (a "treatment" in this client), voided ones apart. */
  treatmentsCompleted: number
  plansAccepted: number
}

export interface StatsSeriesPoint {
  /** First day of the bucket. */
  start: CalendarDate
  total: number
  completed: number
}

export interface StatsTreatmentPoint {
  /** First day of the bucket. */
  start: CalendarDate
  completed: number
}

export interface StatsDoctorLoad {
  doctorId: string
  doctorName: string
  clinicName: string
  appointments: number
  appointmentsCompleted: number
  treatmentsCompleted: number
}

export interface StatsTreatmentTypeCount {
  treatmentTypeId: string
  treatmentTypeName: string
  count: number
}

export interface StatsBusySlot {
  /** ISO weekday, 1 = Monday. */
  weekday: number
  /** Clinic-time hour, 0–23. */
  hour: number
  appointments: number
}

/** Completed treatments on one tooth, by FDI number ("11"–"48"). */
export interface StatsToothCount {
  tooth: string
  count: number
}

export interface StatsOverview {
  range: ReportRange
  totals: StatsTotals
  /** The same-length window right before this one, for the deltas. */
  previousTotals: StatsTotals
  appointmentsSeries: readonly StatsSeriesPoint[]
  treatmentsSeries: readonly StatsTreatmentPoint[]
  doctors: readonly StatsDoctorLoad[]
  treatmentTypes: readonly StatsTreatmentTypeCount[]
  busySlots: readonly StatsBusySlot[]
  teeth: readonly StatsToothCount[]
}
