import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import { PAYMENT_METHODS, type PatientBalance, type Payment } from './types'

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

/** `PaymentSerializer`, validated at runtime (ADR-006). */
export const paymentSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  patient: v.string(),
  patient_name: optionalText,
  amount: money,
  method: v.picklist(PAYMENT_METHODS),
  paid_at: v.pipe(v.string(), v.isoTimestamp()),
  received_by_name: optionalText,
  notes: optionalText,
  voided_at: v.optional(v.nullable(v.string()), null),
  void_reason: optionalText,
})

export const paymentPageSchema = pageSchema(paymentSchema)

export function toPayment(response: v.InferOutput<typeof paymentSchema>): Payment {
  return {
    id: response.id,
    patientId: response.patient,
    patientName: response.patient_name,
    amount: response.amount,
    method: response.method,
    paidAt: response.paid_at,
    receivedByName: response.received_by_name,
    notes: response.notes,
    status: response.voided_at === null ? 'received' : 'voided',
    voidReason: response.void_reason,
  }
}

/** `PatientBalanceSerializer`. */
export const balanceSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  clinic_name: optionalText,
  full_name: v.string(),
  phone_number: optionalText,
  charged: money,
  paid: money,
  debt: money,
})

export const balancePageSchema = pageSchema(balanceSchema)

export function toBalance(response: v.InferOutput<typeof balanceSchema>): PatientBalance {
  return {
    patientId: response.id,
    clinicName: response.clinic_name,
    fullName: response.full_name,
    phoneNumber: response.phone_number,
    charged: response.charged,
    paid: response.paid,
    debt: response.debt,
  }
}
