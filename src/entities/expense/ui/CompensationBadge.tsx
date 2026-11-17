import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatSom } from '@/shared/lib/money'
import { Badge } from '@/shared/ui'
import type { PayTermsSource } from '../model/formSchema'

/**
 * A doctor's terms as a coloured label with a one-line hint under it, so the
 * kind of deal (percent, salary + percent, salary) reads at a glance.
 */
export function CompensationBadge({ compensation }: { compensation: PayTermsSource | null }) {
  const { t, i18n } = useTranslation(['expenses', 'common'])

  if (compensation === null || (compensation.fixed <= 0 && compensation.percent <= 0)) {
    return (
      <Badge tone="warning">
        <TriangleAlert aria-hidden="true" className="size-3.5" />
        {t('expenses:payroll.terms.none')}
      </Badge>
    )
  }

  const percent = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
    compensation.percent,
  )
  const amount = formatSom(compensation.fixed, i18n.language, t('common:currency.som'))
  const baseHint = t(`expenses:payroll.terms.hint.${compensation.base}`)

  let label: string
  let hint: string
  let tone: 'accent' | 'violet' | 'success'
  if (compensation.fixed <= 0) {
    label = t('expenses:payroll.terms.badge.percent', { percent })
    hint = baseHint
    tone = 'accent'
  } else if (compensation.percent <= 0) {
    label = t('expenses:payroll.terms.badge.fixed')
    hint = amount
    tone = 'success'
  } else {
    label = t('expenses:payroll.terms.badge.mixed', { percent })
    hint = `${t('expenses:payroll.terms.hint.fixedAmount', { amount })}, ${baseHint}`
    tone = 'violet'
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={tone}>{label}</Badge>
      <span className="text-caption text-text-secondary">{hint}</span>
    </div>
  )
}
