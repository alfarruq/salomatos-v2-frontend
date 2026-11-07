import { useTranslation } from 'react-i18next'
import type { BotAccessTarget } from '@/entities/bot-access'
import { Dialog } from '@/shared/ui'
import { BotAccessPanel } from './BotAccessPanel'

export interface BotAccessDialogProps {
  clinicId: string
  target: BotAccessTarget
  /** Whose login, for the title. */
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BotAccessDialog({
  clinicId,
  target,
  name,
  open,
  onOpenChange,
}: BotAccessDialogProps) {
  const { t } = useTranslation('bot')

  return (
    <Dialog
      description={t('hint')}
      onOpenChange={onOpenChange}
      open={open}
      title={`${t('title')} — ${name}`}
    >
      <BotAccessPanel clinicId={clinicId} target={target} />
    </Dialog>
  )
}
