import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { MOCK_PATIENTS } from '@/shared/api/mocks/fixtures'
import { patientSchema, toPatient } from './schema'

describe('toPatient', () => {
  it('maps the wire row to the domain row', () => {
    const patient = toPatient(v.parse(patientSchema, MOCK_PATIENTS[0]))

    expect(patient.id).toBe(MOCK_PATIENTS[0]?.id)
    expect(patient.fullName).toBe('Aziza Karimova')
    expect(patient.primaryDoctorName).toBe('Sardor Usmonov')
    expect(patient.gender).toBe('female')
    expect(patient.status).toBe('active')
  })

  it('reads DRF blank strings as "nothing here"', () => {
    const patient = toPatient(v.parse(patientSchema, MOCK_PATIENTS[2]))

    expect(patient.address).toBeNull()
    expect(patient.gender).toBeNull()
    expect(patient.primaryDoctorId).toBeNull()
  })

  it('marks an archived card', () => {
    const patient = toPatient(
      v.parse(patientSchema, { ...MOCK_PATIENTS[0], archived_at: '2026-09-01T00:00:00Z' }),
    )

    expect(patient.status).toBe('archived')
  })

  it('refuses an id that is not a UUID', () => {
    expect(() => v.parse(patientSchema, { ...MOCK_PATIENTS[0], id: 101 })).toThrow()
  })

  it('drops a birth date that does not exist', () => {
    const patient = toPatient(
      v.parse(patientSchema, { ...MOCK_PATIENTS[0], birth_date: '1988-02-31' }),
    )

    expect(patient.birthDate).toBeNull()
  })
})
