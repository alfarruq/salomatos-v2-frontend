import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, toast } from '@/shared/ui'
import type { BotAccess } from '../model/types'

export interface BotAccessDetailsProps {
  access: BotAccess
}

/** Login and password with copy buttons, so staff can paste them into a message to the patient. */
export function BotAccessDetails({ access }: BotAccessDetailsProps) {
  const { t } = useTranslation('bot')

  const copy = (value: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast.success(t('copied')),
      () => toast.error(t('copyFailed')),
    )
  }

  // Two plain lines, so staff can paste them straight into a Telegram message to the patient.
  const copyBoth = () => {
    if (access.password === null) return
    copy(`${t('login')}: ${access.login}\n${t('password')}: ${access.password}`)
  }

  const rows = [
    { key: 'login', label: t('login'), value: access.login },
    { key: 'password', label: t('password'), value: access.password },
  ] as const

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-2">
        {rows.map(({ key, label, value }) => (
          <div className="flex items-center justify-between gap-3" key={key}>
            <div className="flex flex-col">
              <dt className="text-caption text-text-secondary">{label}</dt>
              <dd className="font-mono text-body text-text">{value ?? t('passwordUnavailable')}</dd>
            </div>
            {value === null ? null : (
              <Button
                aria-label={`${t('copy')} — ${label}`}
                onClick={() => copy(value)}
                size="sm"
                variant="ghost"
              >
                <Copy aria-hidden="true" className="size-4" />
              </Button>
            )}
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
