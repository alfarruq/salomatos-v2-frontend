import { describe, expect, it } from 'vitest'
import type { Appointment } from '@/entities/appointment'
import { countToday, findNextAppointment, todaysQueue } from './today'

function appointment(overrides: Partial<Appointment>): Appointment {
  return {
    id: 'a-1',
    clinicName: 'Chilonzor',
    fullName: 'Test',
    phoneNumber: null,
    patientId: 'p-1',
    doctorId: 'd-4',
    doctorName: 'Doctor',
    chairId: null,
    serviceId: null,
    treatmentTypeName: null,
    startAt: '2026-10-09T05:00:00Z',
    endAt: '2026-10-09T05:30:00Z',
    date: '2026-10-09',
    time: '10:00',
    durationMinutes: 30,
    notes: null,
    status: 'scheduled',
    ...overrides,
  }
}

describe('countToday', () => {
  it('splits the day into completed and remaining', () => {
    expect(
      countToday([
        appointment({ id: 'a-1', status: 'completed' }),
        appointment({ id: 'a-2' }),
        appointment({ id: 'a-3' }),
      ]),
    ).toEqual({ total: 3, completed: 1, remaining: 2 })
  })

  it('does not count a cancelled visit or a no-show as still to come', () => {
    expect(
      countToday([
        appointment({ id: 'a-1', status: 'cancelled' }),
        appointment({ id: 'a-2', status: 'no_show' }),
        appointment({ id: 'a-3', status: 'arrived' }),
      ]),
    ).toEqual({ total: 3, completed: 0, remaining: 1 })
  })

  it('is all zeros for an empty day', () => {
    expect(countToday([])).toEqual({ total: 0, completed: 0, remaining: 0 })
  })
})

describe('todaysQueue', () => {
  const rows = [
    appointment({ id: 'a-1', time: '14:00', doctorId: 'd-4' }),
    appointment({ id: 'a-2', time: '09:00', doctorId: 'd-5' }),
    appointment({ id: 'a-3', time: '11:00', doctorId: 'd-4', date: '2026-10-08' }),
  ]

  it("keeps only today's rows, earliest first", () => {
    expect(todaysQueue(rows, { date: '2026-10-09', doctorId: null }).map((a) => a.id)).toEqual([
      'a-2',
      'a-1',
    ])
  })

  it("narrows to one doctor's rows", () => {
    expect(todaysQueue(rows, { date: '2026-10-09', doctorId: 'd-4' }).map((a) => a.id)).toEqual([
      'a-1',
    ])
  })
})

describe('findNextAppointment', () => {
  const queue = [
    appointment({ id: 'a-1', time: '09:00' }),
    appointment({ id: 'a-2', time: '10:00', status: 'completed' }),
    appointment({ id: 'a-3', time: '11:00' }),
  ]

  it('skips past and completed appointments', () => {
    expect(findNextAppointment(queue, '09:30')?.id).toBe('a-3')
  })

  it('never offers a cancelled visit or a no-show as next', () => {
    const day = [
      appointment({ id: 'a-1', time: '10:00', status: 'cancelled' }),
      appointment({ id: 'a-2', time: '10:30', status: 'no_show' }),
      appointment({ id: 'a-3', time: '11:00' }),
    ]
    expect(findNextAppointment(day, '09:30')?.id).toBe('a-3')
  })

  it('counts an appointment due this very minute as next', () => {
    expect(findNextAppointment(queue, '09:00')?.id).toBe('a-1')
  })

  it('is null once nothing open is left', () => {
    expect(findNextAppointment(queue, '12:00')).toBeNull()
  })
})
