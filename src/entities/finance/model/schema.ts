import * as v from 'valibot'
import { type FinanceIncomeTotals, type FinanceOverview, PAYMENT_METHODS } from './types'

/**
 * `GET /api/v1/reports/finance/?from=YYYY-MM-DD&to=YYYY-MM-DD`
 * (`FinanceOverviewSerializer`). Refused to doctors by the server; the
 * frontend gate is UX only (§3). No patient data: debtors have their own list.
 */
const money = v.pipe(
  v.union([v.string(), v.number()]),
  v.transform((value) => Number(value)),
  v.check((value: number) => Number.isFinite(value)),
)
const count = v.pipe(v.number(), v.integer(), v.minValue(0))
const id = v.pipe(v.string(), v.uuid())
const date = v.pipe(v.string(), v.isoDate())

const incomeSchema = v.object({
  billed: money,
  collected: money,
  expenses: money,
  profit: v.nullable(money),
})

export const financeOverviewSchema = v.object({
  from: date,
  to: date,
  bucket: v.picklist(['day', 'week', 'month']),
  totals: v.object({ ...incomeSchema.entries, outstanding_debt: money, debtors_count: count }),
  previous_totals: incomeSchema,
  includes_payroll: v.boolean(),
  series: v.array(v.object({ start: date, billed: money, collected: money, expenses: money })),
  payment_methods: v.array(v.object({ method: v.picklist(PAYMENT_METHODS), amount: money })),
  doctors: v.array(
    v.object({
      doctor: id,
      doctor_name: v.string(),
      clinic_name: v.string(),
      billed: money,
      collected: money,
    }),
  ),
  services: v.array(v.object({ service: id, service_name: v.string(), count, billed: money })),
})

export type FinanceOverviewResponse = v.InferOutput<typeof financeOverviewSchema>

function toIncome(response: FinanceOverviewResponse['previous_totals']): FinanceIncomeTotals {
  return { ...response }
}

export function toFinanceOverview(response: FinanceOverviewResponse): FinanceOverview {
  return {
    range: { from: response.from, to: response.to, bucket: response.bucket },
    totals: {
      ...toIncome(response.totals),
      outstandingDebt: response.totals.outstanding_debt,
      debtorsCount: response.totals.debtors_count,
    },
    previousTotals: toIncome(response.previous_totals),
    includesPayroll: response.includes_payroll,
    series: response.series,
    paymentMethods: response.payment_methods,
    doctors: response.doctors.map((row) => ({
      doctorId: row.doctor,
      doctorName: row.doctor_name,
      clinicName: row.clinic_name,
      billed: row.billed,
      collected: row.collected,
    })),
    services: response.services.map((row) => ({
      serviceId: row.service,
      serviceName: row.service_name,
      count: row.count,
      billed: row.billed,
    })),
  }
}
