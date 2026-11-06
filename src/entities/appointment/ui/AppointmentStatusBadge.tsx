import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '@/shared/ui'
import type { AppointmentStatus } from '../model/types'

export interface AppointmentStatusBadgeProps {
  status: AppointmentStatus
}

/** Red is reserved for deletion (§13), so a no-show is a warning, not danger. */
const tones: Record<AppointmentStatus, BadgeTone> = {
  scheduled: 'neutral',
  confirmed: 'accent',
  arrived: 'accent',
  in_chair: 'accent',
  completed: 'success',
  no_show: 'warning',
  cancelled: 'neutral',
}

/** Passive by design — an entity renders, it does not act (§3.2). */
export function AppointmentStatusBadge({ status }: AppointmentStatusBadgeProps) {
  const { t } = useTranslation('appointments')

  return <Badge tone={tones[status]}>{t(`status.${status}`)}</Badge>
}
