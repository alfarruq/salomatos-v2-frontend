import type { AppointmentStatus } from '@/entities/appointment'

/**
 * The one step the desk takes most: the patient walked in, then the visit
 * ended. Anything rarer (no-show, in chair) stays in the edit dialog.
 */
export function nextStatusOf(status: AppointmentStatus): 'arrived' | 'completed' | null {
  if (status === 'scheduled' || status === 'confirmed') return 'arrived'
  if (status === 'arrived' || status === 'in_chair') return 'completed'
  return null
}
