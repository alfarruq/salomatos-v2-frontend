import { digitsOf } from '@/shared/ui'
import type { ComposerFields, TreatmentRow } from './types'

/** `ProcedureSerializer`'s writable fields. Money is a decimal string, as DRF reads it. */
export interface NewTreatmentPayload {
  patient: string
  doctor: string
  service: string
  tooth: number | null
  unit_price: string
  discount_percent: string
  status: 'in_progress' | 'completed'
  notes: string
}

/** 0–100, whole percent; anything else is not a discount the server accepts. */
export function discountOf(row: Pick<TreatmentRow, 'discountPercent'>): number {
  const value = Number(digitsOf(row.discountPercent) || '0')
  return Math.min(Math.max(value, 0), 100)
}

export function priceOf(row: Pick<TreatmentRow, 'unitPrice'>): number {
  return Number(digitsOf(row.unitPrice) || '0')
}

/** What the line will cost, the same arithmetic the server does. Display only. */
export function lineTotalOf(row: Pick<TreatmentRow, 'unitPrice' | 'discountPercent'>): number {
  return Math.round(priceOf(row) * (1 - discountOf(row) / 100))
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
    discount_percent: String(discountOf(row)),
    status: row.inProgress ? 'in_progress' : 'completed',
    notes: fields.notes,
  }
}
