import { digitsOf } from '@/shared/ui'
import type { ComposerFields, TreatmentRow } from './types'

/** `ProcedureSerializer`'s writable fields. Money is a decimal string, as DRF reads it. */
export interface NewTreatmentPayload {
  patient: string
  doctor: string
  service: string
  tooth: number | null
  unit_price: string
  paid_amount: string
  status: 'in_progress' | 'completed'
  notes: string
}

export function priceOf(row: Pick<TreatmentRow, 'unitPrice'>): number {
  return Number(digitsOf(row.unitPrice) || '0')
}

/** Capped at the price: the server refuses more than the line costs. */
export function paidOf(row: Pick<TreatmentRow, 'unitPrice' | 'paidAmount'>): number {
  return Math.min(Number(digitsOf(row.paidAmount) || '0'), priceOf(row))
}

/** The "paid in full" tick is a view of the amount, not separate state. */
export function isPaidInFull(row: Pick<TreatmentRow, 'unitPrice' | 'paidAmount'>): boolean {
  return priceOf(row) > 0 && paidOf(row) === priceOf(row)
}

export function toNewTreatmentPayload(
  row: TreatmentRow,
  fields: ComposerFields,
  patientId: string,
): NewTreatmentPayload | null {
  if (row.treatmentTypeId === null || fields.doctorId === '') return null

  return {
    patient: patientId,
    doctor: fields.doctorId,
    service: row.treatmentTypeId,
    tooth: row.toothNumber,
    unit_price: String(priceOf(row)),
    paid_amount: String(paidOf(row)),
    status: row.inProgress ? 'in_progress' : 'completed',
    notes: fields.notes,
  }
}
