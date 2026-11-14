import { describe, expect, it } from 'vitest'
import type { Treatment } from '@/entities/treatment'
import { summarizeTeeth } from './toothSummary'

function treatment(overrides: Partial<Treatment>): Treatment {
  return {
    id: 'p-1',
    patientId: 'patient-1',
    patientName: null,
    doctorId: null,
    doctorName: null,
    serviceId: 'service-1',
    treatmentTypeName: 'Plomba',
    toothNumber: 16,
    surfaces: [],
    quantity: 1,
    unitPrice: 100,
    totalTreatmentCost: 100,
    performedAt: '2026-09-01T06:00:00Z',
    startDate: '2026-09-01',
    notes: null,
    status: 'done',
    completedAt: '2026-09-01T06:00:00Z',
    voidReason: null,
    ...overrides,
  }
}

describe('summarizeTeeth', () => {
  it('marks a tooth that has recorded work', () => {
    expect(summarizeTeeth([treatment({})]).values['16']).toBe('done')
  })

  it('leaves out a voided line: a mistake is not work on the tooth', () => {
    expect(summarizeTeeth([treatment({ status: 'voided' })]).values).toEqual({})
  })

  it('lists the real type names once each', () => {
    const summary = summarizeTeeth([
      treatment({ id: 'p-1', treatmentTypeName: 'Эндо Тиадент' }),
      treatment({ id: 'p-2', treatmentTypeName: 'Plomba' }),
      treatment({ id: 'p-3', treatmentTypeName: 'Эндо Тиадент' }),
    ])
    expect(summary.names['16']).toEqual(['Эндо Тиадент', 'Plomba'])
  })

  it('picks the latest procedure by time, not by list order', () => {
    const summary = summarizeTeeth([
      treatment({ id: 'p-5', performedAt: '2026-09-10T06:00:00Z' }),
      treatment({ id: 'p-9', performedAt: '2026-08-01T06:00:00Z' }),
    ])
    expect(summary.latest['16']?.id).toBe('p-5')
  })

  it('skips procedures with no tooth', () => {
    expect(summarizeTeeth([treatment({ toothNumber: null })]).values).toEqual({})
  })

  it('marks a tooth in progress while any of its work is unfinished', () => {
    const summary = summarizeTeeth([
      treatment({ id: 'p-1', toothNumber: 24, performedAt: '2026-09-10T06:00:00Z' }),
      treatment({ id: 'p-2', toothNumber: 24, status: 'inProgress', completedAt: null }),
      treatment({ id: 'p-3', toothNumber: 16 }),
    ])
    expect(summary.values).toEqual({ '24': 'inProgress', '16': 'done' })
    expect(summary.counts).toEqual({ done: 1, inProgress: 1 })
  })

  it('opens the unfinished treatment of a tooth, so it can be completed', () => {
    const summary = summarizeTeeth([
      treatment({ id: 'p-old', status: 'inProgress', completedAt: null }),
      treatment({ id: 'p-new', performedAt: '2026-09-10T06:00:00Z' }),
    ])
    expect(summary.latest['16']?.id).toBe('p-old')
  })

  it('keeps every line of a tooth in its history, voided too, newest first', () => {
    const summary = summarizeTeeth([
      treatment({ id: 'p-1', performedAt: '2026-08-01T06:00:00Z' }),
      treatment({ id: 'p-2', status: 'voided', performedAt: '2026-09-01T06:00:00Z' }),
      treatment({ id: 'p-3', toothNumber: null }),
    ])
    expect(summary.history['16']?.map((row) => row.id)).toEqual(['p-2', 'p-1'])
  })
})
