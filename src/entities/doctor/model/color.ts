import type { DoctorId } from './types'

export interface DoctorColor {
  /** Small dot next to the doctor's name. */
  dot: string
}

/**
 * Full class strings, not `bg-doctor-${n}`: Tailwind only generates classes it
 * can find verbatim in the source.
 */
const PALETTE: readonly DoctorColor[] = [
  { dot: 'bg-doctor-1' },
  { dot: 'bg-doctor-2' },
  { dot: 'bg-doctor-3' },
  { dot: 'bg-doctor-4' },
  { dot: 'bg-doctor-5' },
  { dot: 'bg-doctor-6' },
  { dot: 'bg-doctor-7' },
  { dot: 'bg-doctor-8' },
]

/** No doctor assigned: a neutral dot. */
const UNASSIGNED: DoctorColor = { dot: 'bg-border-strong' }

/**
 * Derived from the id so a doctor keeps the same colour on every screen and
 * every visit, with nothing stored. Past eight doctors colours repeat, which
 * is why the name is always shown beside them.
 */
export function doctorColorOf(doctorId: DoctorId | null): DoctorColor {
  if (doctorId === null) return UNASSIGNED
  // A small, stable hash of the UUID; any spread is fine, it only has to be deterministic.
  let hash = 0
  for (const char of doctorId) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? UNASSIGNED
}
