import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, toast } from '@/shared/ui'
import type { BotAccess } from '../model/types'

export interface BotAccessDetailsProps {
  access: BotAccess
}

/** Login and password with one copy button, so staff can paste them into a message to the patient. */
export function BotAccessDetails({ access }: BotAccessDetailsProps) {
  const { t } = useTranslation('bot')

  // One button, two plain lines, so staff paste it straight into a Telegram message.
  // The labels match what the bot asks for, so they stay the same in every language.
  const copyBoth = () => {
    if (access.password === null) return
    navigator.clipboard.writeText(`login: ${access.login}\npassword: ${access.password}`).then(
      () => toast.success(t('copied')),
      () => toast.error(t('copyFailed')),
    )
  }

  const rows = [
    { key: 'login', label: t('login'), value: access.login },
    { key: 'password', label: t('password'), value: access.password },
  ] as const

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-2">
        {rows.map(({ key, label, value }) => (
          <div className="flex flex-col" key={key}>
            <dt className="text-caption text-text-secondary">{label}</dt>
            <dd className="font-mono text-body text-text">{value ?? t('passwordUnavailable')}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {access.password === null ? null : (
          <Button
            iconLeft={<Copy aria-hidden="true" className="size-4" />}
            onClick={copyBoth}
            size="sm"
            variant="secondary"
          >
            {t('copyBoth')}
          </Button>
        )}
        <Badge tone={access.isLinked ? 'success' : 'neutral'}>
          {access.isLinked ? t('linked') : t('notLinked')}
        </Badge>
      </div>
    </div>
  )
}
