import type { AvatarTone } from '@/shared/ui'
import type { DoctorTypeId } from './types'

/** Every clinic has the dental type, so it gets a fixed colour that never collides with a hashed one. */
const DENTAL_TONE: AvatarTone = 1
const OTHER_TONES: readonly AvatarTone[] = [2, 3, 4, 5, 6]

/**
 * Derived from the id so a type keeps its colour everywhere with nothing
 * stored. Past five non-dental types colours repeat, which is why the name is
 * always printed on the badge.
 */
export function doctorTypeToneOf(
  id: DoctorTypeId | null,
  isDental: boolean,
): AvatarTone | undefined {
  if (isDental) return DENTAL_TONE
  if (id === null) return undefined
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return OTHER_TONES[Math.abs(hash) % OTHER_TONES.length]
}
