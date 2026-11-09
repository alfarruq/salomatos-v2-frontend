import { describe, expect, it } from 'vitest'
import { MEDICATION_CATALOG } from './catalog'
import {
  fillFromCatalog,
  fromSavedMedicine,
  fromVoiceMedicine,
  isRowComplete,
  newMedicineRow,
  toMedicinePayload,
  toRecipePayload,
} from './payload'

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

describe('fromVoiceMedicine', () => {
  const dictated = {
    medicine: 'Amoxicillin 500 mg',
    dose: '1',
    form: 'capsule',
    timesPerDay: 3,
    durationDays: 7,
    mealRelation: 'after' as const,
    instructions: '',
  }

  it('maps a fully dictated medicine onto a complete row', () => {
    const row = fromVoiceMedicine(dictated)
    expect(row).toMatchObject({
      name: 'Amoxicillin 500 mg',
      dose: '1',
      form: 'capsule',
      frequency: 'tid',
      meal: 'after',
      durationAmount: '7',
      durationUnit: 'days',
    })
    expect(isRowComplete(row)).toBe(true)
  })

  it('leaves an unsaid dose or duration empty so the doctor must finish the row', () => {
    const row = fromVoiceMedicine({
      ...dictated,
      dose: '500 mg',
      durationDays: null,
      form: 'pill',
      mealRelation: 'any',
    })
    expect(row.dose).toBe('')
    expect(row.durationAmount).toBe('')
    expect(row.form).toBe('tablet')
    expect(row.meal).toBe('none')
    expect(isRowComplete(row)).toBe(false)
  })
})

describe('fromSavedMedicine', () => {
  it('turns a saved item back into a complete row that saves the same', () => {
    const row = fromSavedMedicine({
      id: 'item-1',
      name: 'Amoksiklav 625 mg',
      dose: 1,
      type: 'capsule',
      frequency: 'tid',
      timesPerDay: 3,
      duration: 7,
      meal: 'with',
      instructions: 'Suv bilan',
    })

    expect(toMedicinePayload(row)).toEqual({
      medicine: 'Amoksiklav 625 mg',
      dose: '1',
      form: 'capsule',
      times_per_day: 3,
      duration_days: 7,
      meal_relation: 'with',
      instructions: 'Suv bilan',
    })
  })

  it('leaves a dose that is not a count empty, so the doctor re-enters it', () => {
    const row = fromSavedMedicine({
      id: 'item-2',
      name: 'Ibuprofen',
      dose: null,
      type: '400 mg tabletka',
      frequency: 'bid',
      timesPerDay: 2,
      duration: 3,
      meal: 'after',
      instructions: null,
    })

    expect(row.dose).toBe('')
    expect(row.form).toBe('tablet')
    expect(isRowComplete(row)).toBe(false)
  })
})
