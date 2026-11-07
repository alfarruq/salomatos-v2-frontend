import type { CalendarDate } from '@/shared/lib/calendarDate'
import type { ReportRange } from '@/shared/lib/report'

/** `Payment.Method`; repeated here because entities do not import each other (§4). */
export const PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Every figure is the server's own sum: the browser displays totals, it never adds money up. */
export interface FinanceIncomeTotals {
  /** Work done in the period, at its price. */
  billed: number
  /** Payments received in the period, for any work. */
  collected: number
  /** Money paid out in the period; without pay rows unless the viewer may see payroll. */
  expenses: number
  /** `collected − expenses`, or null when expenses leave pay out and so prove nothing. */
  profit: number | null
}

export interface FinanceTotals extends FinanceIncomeTotals {
  /** Everything owed to the clinic now. */
  outstandingDebt: number
  debtorsCount: number
}

export interface FinanceSeriesPoint {
  /** First day of the bucket. */
  start: CalendarDate
  billed: number
  collected: number
  expenses: number
}

export interface FinanceMethodAmount {
  method: PaymentMethod
  amount: number
}

export interface FinanceDoctorAmount {
  doctorId: string
  doctorName: string
  clinicName: string
  billed: number
  /** Money collected in the period for this doctor's work, oldest work first. */
  collected: number
}

export interface FinanceServiceAmount {
  serviceId: string
  serviceName: string
  count: number
  billed: number
}

export interface FinanceOverview {
  range: ReportRange
  totals: FinanceTotals
  /** The same-length window right before this one, for the deltas. */
  previousTotals: FinanceIncomeTotals
  /** False for a viewer without `payroll:view`: expenses then leave pay out. */
  includesPayroll: boolean
  series: readonly FinanceSeriesPoint[]
  paymentMethods: readonly FinanceMethodAmount[]
  doctors: readonly FinanceDoctorAmount[]
  /** The ten services that billed most. */
  services: readonly FinanceServiceAmount[]
}
