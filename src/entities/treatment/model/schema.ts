import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import { clinicDayOf } from '@/shared/lib/datetime'
import type { ToothSurface, Treatment } from './types'

const optionalText = v.pipe(
  v.optional(v.nullable(v.string()), null),
  v.transform((value) => (value === null || value === '' ? null : value)),
)

/** DRF sends `DecimalField` as a string; so'm fit a double exactly. */
const money = v.pipe(
  v.union([v.string(), v.number()]),
  v.transform((value) => Number(value)),
  v.check((value: number) => Number.isFinite(value)),
)

const SURFACES: readonly ToothSurface[] = ['M', 'O', 'D', 'B', 'L', 'I']

/** `ProcedureSerializer`, validated at runtime (ADR-006). */
export const treatmentSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  patient: v.string(),
  patient_name: optionalText,
  doctor: v.optional(v.nullable(v.string()), null),
  doctor_name: optionalText,
  service: v.string(),
  service_name: optionalText,
  tooth: v.optional(v.nullable(v.number()), null),
  surfaces: v.pipe(
    v.optional(v.array(v.string()), []),
    v.transform((values) =>
      values.filter((value): value is ToothSurface => SURFACES.includes(value as ToothSurface)),
    ),
  ),
  quantity: v.optional(v.number(), 1),
  unit_price: money,
  discount_percent: v.optional(money, '0'),
  total: money,
  performed_at: v.pipe(v.string(), v.isoTimestamp()),
  notes: optionalText,
  voided_at: v.optional(v.nullable(v.string()), null),
  void_reason: optionalText,
})

export const treatmentPageSchema = pageSchema(treatmentSchema)

export type TreatmentResponse = v.InferOutput<typeof treatmentSchema>

export function toTreatment(response: TreatmentResponse): Treatment {
  return {
    id: response.id,
    patientId: response.patient,
    patientName: response.patient_name,
    doctorId: response.doctor,
    doctorName: response.doctor_name,
    serviceId: response.service,
    treatmentTypeName: response.service_name,
    toothNumber: response.tooth,
    surfaces: response.surfaces,
    quantity: response.quantity,
    unitPrice: response.unit_price,
    discountPercent: response.discount_percent,
    totalTreatmentCost: response.total,
    performedAt: response.performed_at,
    startDate: clinicDayOf(response.performed_at),
    notes: response.notes,
    status: response.voided_at === null ? 'done' : 'voided',
    voidReason: response.void_reason,
  }
}
