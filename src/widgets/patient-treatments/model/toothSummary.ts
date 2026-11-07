import type { Treatment } from '@/entities/treatment'

/** A tooth with any work still under way is in progress, whatever else was finished on it. */
export type ToothState = 'done' | 'inProgress'

export interface ToothSummary {
  /** FDI → colour status. Only teeth with recorded work appear. */
  values: Record<string, ToothState>
  /** FDI → the treatment types done on it, real backend names, no repeats. */
  names: Record<string, string[]>
  /**
   * FDI → the treatment a click opens: the latest one still in progress, so
   * the doctor can complete it from there, else the latest one.
   */
  latest: Record<string, Treatment>
  /** How many teeth are in each state, for the legend. */
  counts: Record<ToothState, number>
}

/**
 * Open work outranks finished work; within the same rank the later instant
 * wins (UTC ISO strings compare correctly as strings).
 */
function isNewer(candidate: Treatment, current: Treatment): boolean {
  const candidateOpen = candidate.status === 'inProgress'
  const currentOpen = current.status === 'inProgress'
  if (candidateOpen !== currentOpen) return candidateOpen
  return candidate.performedAt > current.performedAt
}

/**
 * One pass over the treatments, building all three maps. A voided line is a
 * mistake, not work on the tooth, so it is left out entirely.
 */
export function summarizeTeeth(treatments: readonly Treatment[]): ToothSummary {
  const values: Record<string, ToothState> = {}
  const names: Record<string, string[]> = {}
  const latest: Record<string, Treatment> = {}

  for (const treatment of treatments) {
    if (treatment.toothNumber === null || treatment.status === 'voided') continue
    const tooth = String(treatment.toothNumber)
    if (treatment.status === 'inProgress') values[tooth] = 'inProgress'
    else if (values[tooth] === undefined) values[tooth] = 'done'

    const label = treatment.treatmentTypeName
    if (label !== null && label !== '') {
      const list = names[tooth] ?? []
      if (!list.includes(label)) list.push(label)
      names[tooth] = list
    }

    const existing = latest[tooth]
    if (existing === undefined || isNewer(treatment, existing)) latest[tooth] = treatment
  }

  const counts: Record<ToothState, number> = { done: 0, inProgress: 0 }
  for (const state of Object.values(values)) counts[state] += 1

  return { values, names, latest, counts }
}
