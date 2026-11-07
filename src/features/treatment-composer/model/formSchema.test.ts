import { describe, expect, it } from 'vitest'
import { lineTotalOf, toNewTreatmentPayload } from './formSchema'
import type { ComposerFields, TreatmentRow } from './types'

const fields: ComposerFields = { doctorId: 'doctor-1', notes: 'Izoh' }

const row: TreatmentRow = {
  rowId: 'row-1',
  toothNumber: 16,
  treatmentTypeId: 'service-1',
  treatmentTypeName: 'Implantatsiya',
  unitPrice: '1,200,000',
  discountPercent: '10',
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
      discount_percent: '10',
      status: 'completed',
      notes: 'Izoh',
    })
  })

  it('refuses a row with no service or no doctor rather than send a half record', () => {
    expect(toNewTreatmentPayload({ ...row, treatmentTypeId: null }, fields, 'p')).toBeNull()
    expect(toNewTreatmentPayload(row, { ...fields, doctorId: '' }, 'p')).toBeNull()
  })

  it('clamps a discount over 100 percent', () => {
    expect(
      toNewTreatmentPayload({ ...row, discountPercent: '250' }, fields, 'p')?.discount_percent,
    ).toBe('100')
  })
})

describe('lineTotalOf', () => {
  it('applies the discount the way the server will', () => {
    expect(lineTotalOf(row)).toBe(1_080_000)
  })
})
