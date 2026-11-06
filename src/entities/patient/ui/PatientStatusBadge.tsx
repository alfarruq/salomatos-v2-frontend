import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '@/shared/ui'
import type { PatientStatus } from '../model/types'

export interface PatientStatusBadgeProps {
  status: PatientStatus
}

const tones: Record<PatientStatus, BadgeTone> = {
  active: 'success',
  archived: 'neutral',
}

/** Shows whether the card is archived. Passive by design — an entity renders, it does not act (§4). */
export function PatientStatusBadge({ status }: PatientStatusBadgeProps) {
  const { t } = useTranslation('patients')
  return <Badge tone={tones[status]}>{t(`status.${status}`)}</Badge>
}
