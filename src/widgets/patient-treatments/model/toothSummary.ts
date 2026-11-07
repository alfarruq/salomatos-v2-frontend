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
  /** FDI → every line on that tooth, voided ones included, newest first. */
  history: Record<string, Treatment[]>
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
 * One pass over the treatments. A voided line is a mistake, not work on the
 * tooth, so it colours nothing; only the per-tooth history keeps it.
 */
export function summarizeTeeth(treatments: readonly Treatment[]): ToothSummary {
  const values: Record<string, ToothState> = {}
  const names: Record<string, string[]> = {}
  const latest: Record<string, Treatment> = {}

  const history: Record<string, Treatment[]> = {}

  for (const treatment of treatments) {
    if (treatment.toothNumber === null) continue
    // The history keeps a voided line, struck through, so the record explains itself.
    const lines = history[String(treatment.toothNumber)] ?? []
    lines.push(treatment)
    history[String(treatment.toothNumber)] = lines
    if (treatment.status === 'voided') continue
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

  for (const lines of Object.values(history)) {
    lines.sort((a, b) =>
      a.performedAt < b.performedAt ? 1 : a.performedAt > b.performedAt ? -1 : 0,
    )
  }

  return { values, names, latest, history, counts }
}
