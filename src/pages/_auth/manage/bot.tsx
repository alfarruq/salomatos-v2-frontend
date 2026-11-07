import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { BotAccessPanel } from '@/features/bot-access-manage'
import { Card } from '@/shared/ui'

export const Route = createFileRoute('/_auth/manage/bot')({
  component: BotSection,
})

/** The owner's own Telegram bot login. Doctors' logins are on the doctors' list. */
function BotSection() {
  const { t } = useTranslation('bot')
  const { clinicId } = Route.useRouteContext()

  return (
    <Card className="flex max-w-lg flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-headline text-text">{t('mine')}</h2>
        <p className="text-caption text-text-secondary">{t('mineHint')}</p>
      </div>
      <BotAccessPanel clinicId={clinicId} target={{ kind: 'mine' }} />
    </Card>
  )
}
