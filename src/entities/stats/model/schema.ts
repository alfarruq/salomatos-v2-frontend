import * as v from 'valibot'
import type { StatsOverview, StatsTotals } from './types'

/**
 * `GET /api/v1/reports/statistics/?from=YYYY-MM-DD&to=YYYY-MM-DD`
 * (`StatisticsOverviewSerializer`). Counts only, computed server-side in the
 * clinic's zone (§14): no names, phones or patient ids. Refused to doctors by
 * the server; the frontend gate is UX only (§3).
 */
const count = v.pipe(v.number(), v.integer(), v.minValue(0))
const date = v.pipe(v.string(), v.isoDate())
const id = v.pipe(v.string(), v.uuid())

const totalsSchema = v.object({
  appointments: count,
  appointments_completed: count,
  no_shows: count,
  cancellations: count,
  new_patients: count,
  returning_patients: count,
  procedures: count,
  plans_accepted: count,
})

export const statsOverviewSchema = v.object({
  from: date,
  to: date,
  bucket: v.picklist(['day', 'week', 'month']),
  totals: totalsSchema,
  previous_totals: totalsSchema,
  appointments_series: v.array(v.object({ start: date, total: count, completed: count })),
  procedures_series: v.array(v.object({ start: date, count })),
  doctors: v.array(
    v.object({
      doctor: id,
      doctor_name: v.string(),
      clinic_name: v.string(),
      appointments: count,
      appointments_completed: count,
      procedures: count,
    }),
  ),
  services: v.array(v.object({ service: id, service_name: v.string(), count })),
  busy_slots: v.array(
    v.object({
      weekday: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(7)),
      hour: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(23)),
      appointments: count,
    }),
  ),
  // FDI numbers; the tooth chart keys them as strings.
  teeth: v.array(
    v.object({
      tooth: v.pipe(v.number(), v.integer(), v.transform(String), v.regex(/^[1-4][1-8]$/)),
      count,
    }),
  ),
})

export type StatsOverviewResponse = v.InferOutput<typeof statsOverviewSchema>

function toTotals(response: StatsOverviewResponse['totals']): StatsTotals {
  return {
    appointments: response.appointments,
    appointmentsCompleted: response.appointments_completed,
    noShows: response.no_shows,
    cancellations: response.cancellations,
    newPatients: response.new_patients,
    returningPatients: response.returning_patients,
    treatmentsCompleted: response.procedures,
    plansAccepted: response.plans_accepted,
  }
}

export function toStatsOverview(response: StatsOverviewResponse): StatsOverview {
  return {
    range: { from: response.from, to: response.to, bucket: response.bucket },
    totals: toTotals(response.totals),
    previousTotals: toTotals(response.previous_totals),
    appointmentsSeries: response.appointments_series,
    treatmentsSeries: response.procedures_series.map((point) => ({
      start: point.start,
      completed: point.count,
    })),
    doctors: response.doctors.map((row) => ({
      doctorId: row.doctor,
      doctorName: row.doctor_name,
      clinicName: row.clinic_name,
      appointments: row.appointments,
      appointmentsCompleted: row.appointments_completed,
      treatmentsCompleted: row.procedures,
    })),
    treatmentTypes: response.services.map((row) => ({
      treatmentTypeId: row.service,
      treatmentTypeName: row.service_name,
      count: row.count,
    })),
    busySlots: response.busy_slots,
    teeth: response.teeth,
  }
}
