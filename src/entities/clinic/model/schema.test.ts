import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { clinicSchema, toClinic } from './schema'

describe('toClinic', () => {
  it('reads the fields the profile is built from', () => {
    const clinic = toClinic(
      v.parse(clinicSchema, {
        name: 'Salomat Dental',
        phone_number: '+998901112233',
        address: 'Chilonzor 12',
        id: '00000000-0000-4000-8002-000000000001',
        working_hours: { mon: { open: '09:00', close: '18:00' }, sun: null },
      }),
    )

    expect(clinic.name).toBe('Salomat Dental')
    expect(clinic.workingHours.mon).toEqual({ open: '09:00', close: '18:00' })
    expect(clinic.workingHours.sun).toBeNull()
  })

  it('treats a day the JSON blob does not mention as unset, not closed', () => {
    // `sat` is absent entirely — different from `sun: null` above, and the
    // summary card must not claim to know either way.
    const clinic = toClinic(
      v.parse(clinicSchema, {
        name: 'Salomat Dental',
        phone_number: '+998901112233',
        address: '',
        id: '00000000-0000-4000-8002-000000000001',
        working_hours: { mon: { open: '09:00', close: '18:00' } },
      }),
    )

    expect(clinic.workingHours.sat).toBeUndefined()
  })

  it('does not throw on a shape this client did not invent', () => {
    /*
     * `working_hours` is a bare JSONField with no server-declared shape. A
     * clinic created before this format existed, or edited directly in
     * Django admin, should not crash the page — it should just show no hours
     * set.
     */
    const clinic = toClinic(
      v.parse(clinicSchema, {
        name: 'Salomat Dental',
        phone_number: '+998901112233',
        address: '',
        id: '00000000-0000-4000-8002-000000000001',
        working_hours: { note: 'closed on holidays', mon: 'all day' },
      }),
    )

    expect(clinic.workingHours).toEqual({})
  })

  it('survives a completely absent working_hours', () => {
    const clinic = toClinic(
      v.parse(clinicSchema, {
        name: 'Salomat Dental',
        phone_number: '+998901112233',
        address: '',
        id: '00000000-0000-4000-8002-000000000001',
      }),
    )

    expect(clinic.workingHours).toEqual({})
  })

  it('defaults a missing address to an empty string rather than refusing to load', () => {
    const clinic = toClinic(
      v.parse(clinicSchema, {
        id: '00000000-0000-4000-8002-000000000001',
        name: 'Salomat Dental',
        phone_number: '+998901112233',
      }),
    )

    expect(clinic.address).toBe('')
  })
})
