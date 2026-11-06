import { describe, expect, it } from 'vitest'
import { MEDICATION_CATALOG } from './catalog'
import { fillFromCatalog, newMedicineRow, toMedicinePayload, toRecipePayload } from './payload'

describe('toMedicinePayload', () => {
  it('sends the fields PrescriptionItemSerializer takes', () => {
    expect(toMedicinePayload({ ...newMedicineRow(), name: ' Amoksiklav 625 mg ' })).toEqual({
      medicine: 'Amoksiklav 625 mg',
      dose: '1',
      form: 'tablet',
      times_per_day: 2,
      duration_days: 5,
      meal_relation: 'after',
      instructions: '',
    })
  })

  it('stores a course in weeks as days — the server has no unit field', () => {
    const row = {
      ...newMedicineRow(),
      name: 'X',
      durationAmount: '2',
      durationUnit: 'weeks' as const,
    }
    expect(toMedicinePayload(row)?.duration_days).toBe(14)
  })

  it("sends 'regardless of food' as the server's any", () => {
    expect(toMedicinePayload({ ...newMedicineRow(), name: 'X', meal: 'none' })?.meal_relation).toBe(
      'any',
    )
  })

  it('refuses rather than guesses a missing dose or duration', () => {
    expect(toMedicinePayload({ ...newMedicineRow(), name: 'X', dose: '' })).toBeNull()
    expect(toMedicinePayload({ ...newMedicineRow(), name: 'X', dose: '0' })).toBeNull()
    expect(toMedicinePayload({ ...newMedicineRow(), name: 'X', durationAmount: '' })).toBeNull()
    expect(toMedicinePayload({ ...newMedicineRow(), name: '  ' })).toBeNull()
  })
})

describe('fillFromCatalog', () => {
  it('fills the whole row from the pick, keeping the row identity', () => {
    const row = newMedicineRow()
    const ketorol = MEDICATION_CATALOG.find((medicine) => medicine.name === 'Ketorol 10 mg')
    if (ketorol === undefined) throw new Error('catalog lost Ketorol')

    expect(fillFromCatalog(row, ketorol)).toEqual({
      rowId: row.rowId,
      name: 'Ketorol 10 mg',
      dose: '1',
      form: 'tablet',
      frequency: 'tid',
      meal: 'after',
      durationAmount: '3',
      durationUnit: 'days',
    })
  })
})

describe('toRecipePayload', () => {
  it('drops unnamed rows and trims the note', () => {
    expect(
      toRecipePayload({
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        notes: '  Issiq ichmang ',
        rows: [newMedicineRow(), { ...newMedicineRow(), name: 'Nimesil 100 mg' }],
      }),
    ).toEqual({
      patient: 'patient-1',
      doctor: 'doctor-1',
      notes: 'Issiq ichmang',
      items: [expect.objectContaining({ medicine: 'Nimesil 100 mg' })],
    })
  })
})

describe('MEDICATION_CATALOG', () => {
  it('has unique names — cmdk keys items by them', () => {
    const names = MEDICATION_CATALOG.map((medicine) => medicine.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
