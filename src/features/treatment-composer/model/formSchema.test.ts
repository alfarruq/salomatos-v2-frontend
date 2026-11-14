import { describe, expect, it } from 'vitest'
import { isPaidInFull, paidOf, toNewTreatmentPayload } from './formSchema'
import type { ComposerFields, TreatmentRow } from './types'

const fields: ComposerFields = { doctorId: 'doctor-1', notes: 'Izoh' }

const row: TreatmentRow = {
  rowId: 'row-1',
  toothNumber: 16,
  treatmentTypeId: 'service-1',
  treatmentTypeName: 'Implantatsiya',
  unitPrice: '1,200,000',
  paidAmount: '',
  inProgress: false,
}

describe('toNewTreatmentPayload', () => {
  it('sends ids and money as the decimal strings DRF reads', () => {
    expect(toNewTreatmentPayload(row, fields, 'patient-1')).toEqual({
      patient: 'patient-1',
      doctor: 'doctor-1',
      service: 'service-1',
      tooth: 16,
      unit_price: '1200000',
      paid_amount: '0',
      status: 'completed',
      notes: 'Izoh',
    })
  })

  it('refuses a row with no service or no doctor rather than send a half record', () => {
    expect(toNewTreatmentPayload({ ...row, treatmentTypeId: null }, fields, 'p')).toBeNull()
    expect(toNewTreatmentPayload(row, { ...fields, doctorId: '' }, 'p')).toBeNull()
  })

  it('never sends more paid than the line costs', () => {
    expect(
      toNewTreatmentPayload({ ...row, paidAmount: '5,000,000' }, fields, 'p')?.paid_amount,
    ).toBe('1200000')
  })
})

describe('paid in full', () => {
  it('is true only when the whole price has been taken', () => {
    expect(isPaidInFull({ ...row, paidAmount: '1,200,000' })).toBe(true)
    expect(isPaidInFull({ ...row, paidAmount: '600,000' })).toBe(false)
    expect(isPaidInFull({ ...row, unitPrice: '0', paidAmount: '' })).toBe(false)
  })

  it('caps the amount at the price', () => {
    expect(paidOf({ ...row, paidAmount: '9,999,999' })).toBe(1_200_000)
  })
})
