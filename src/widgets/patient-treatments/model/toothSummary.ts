import type { Treatment } from '@/entities/treatment'

export interface ToothSummary {
  /** FDI → colour status. Only teeth with recorded work appear. */
  values: Record<string, 'done'>
  /** FDI → the treatment types done on it, real backend names, no repeats. */
  names: Record<string, string[]>
  /** FDI → that tooth's most recent treatment, opened on click. */
  latest: Record<string, Treatment>
}

/** The later instant wins; UTC ISO strings compare correctly as strings. */
function isNewer(candidate: Treatment, current: Treatment): boolean {
  return candidate.performedAt > current.performedAt
}

/**
 * One pass over the treatments, building all three maps. A voided line is a
 * mistake, not work on the tooth, so it is left out entirely.
 */
export function summarizeTeeth(treatments: readonly Treatment[]): ToothSummary {
  const values: Record<string, 'done'> = {}
  const names: Record<string, string[]> = {}
  const latest: Record<string, Treatment> = {}

  for (const treatment of treatments) {
    if (treatment.toothNumber === null || treatment.status === 'voided') continue
    const tooth = String(treatment.toothNumber)
    values[tooth] = 'done'

    const label = treatment.treatmentTypeName
    if (label !== null && label !== '') {
      const list = names[tooth] ?? []
      if (!list.includes(label)) list.push(label)
      names[tooth] = list
    }

    const existing = latest[tooth]
    if (existing === undefined || isNewer(treatment, existing)) latest[tooth] = treatment
  }

  return { values, names, latest }
}
