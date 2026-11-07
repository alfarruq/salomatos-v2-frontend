import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '@/shared/ui'
import type { TreatmentStatus } from '../model/types'

export interface TreatmentStatusBadgeProps {
  status: TreatmentStatus
}

const tones: Record<TreatmentStatus, BadgeTone> = {
  done: 'success',
  inProgress: 'warning',
  voided: 'neutral',
}

/** Passive by design — voiding is a feature (§4). */
export function TreatmentStatusBadge({ status }: TreatmentStatusBadgeProps) {
  const { t } = useTranslation('treatments')
  return <Badge tone={tones[status]}>{t(`status.${status}`)}</Badge>
}
