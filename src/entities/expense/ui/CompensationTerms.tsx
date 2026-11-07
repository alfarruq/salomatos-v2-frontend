import { useTranslation } from 'react-i18next'
import { formatSom } from '@/shared/lib/money'
import type { Compensation } from '../model/types'

/** A doctor's terms in one line: "Oklad 2,000,000 so'm + 15% tushumdan". */
export function CompensationTerms({ compensation }: { compensation: Compensation | null }) {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  if (compensation === null) return <>{t('expenses:payroll.terms.none')}</>

  const percent = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
    compensation.percent,
  )
  const parts: string[] = []
  if (compensation.fixed > 0) {
    parts.push(
      t('expenses:payroll.terms.fixed', {
        amount: formatSom(compensation.fixed, i18n.language, t('common:currency.som')),
      }),
    )
  }
  if (compensation.percent > 0) {
    parts.push(t(`expenses:payroll.terms.percent.${compensation.base}`, { percent }))
  }
  return <>{parts.join(' + ')}</>
}
