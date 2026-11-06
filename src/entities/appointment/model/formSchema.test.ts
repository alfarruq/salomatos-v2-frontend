import { describe, expect, it } from 'vitest'
import { mockId } from '@/shared/api/mocks/fixtures'
import { emptyAppointmentForm, toAppointmentPayload } from './formSchema'

const BASE = {
  ...emptyAppointmentForm,
  fullName: 'Aziza Karimova',
  patientId: mockId(7, 1),
  doctorId: mockId(4, 4),
  date: '2026-10-08',
  time: '09:30',
}

describe('toAppointmentPayload', () => {
  it("turns the clinic's wall clock into UTC instants", () => {
    // Tashkent is UTC+5: 09:30 there is 04:30 UTC.
    const payload = toAppointmentPayload({ ...BASE, durationMinutes: '45' })

    expect(payload.start_at).toBe('2026-10-08T04:30:00.000Z')
    expect(payload.end_at).toBe('2026-10-08T05:15:00.000Z')
  })

  it('puts an early-morning visit on the clinic day, not the UTC one', () => {
    const payload = toAppointmentPayload({ ...BASE, time: '02:00' })

    expect(payload.start_at).toBe('2026-10-07T21:00:00.000Z')
  })

  it('sends ids, and no service as null', () => {
    expect(toAppointmentPayload(BASE)).toMatchObject({
      patient: mockId(7, 1),
      doctor: mockId(4, 4),
      service: null,
      status: 'scheduled',
    })
  })
})
