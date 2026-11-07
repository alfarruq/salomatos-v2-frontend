import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FinanceIncomeTotals, FinanceTotals } from '@/entities/finance'
import { formatSom } from '@/shared/lib/money'
import { percentChange } from '@/shared/lib/report'
import { Card } from '@/shared/ui'

/**
 * Three headline sums, each with its change against the previous window. The
 * change is told by icon and sign, not colour: whether more debt or more
 * billing is "good" depends on the reader's question, not on the number.
 */
export function FinanceKpis({
  totals,
  previous,
}: {
  totals: FinanceTotals
  previous: FinanceIncomeTotals
}) {
  const { t, i18n } = useTranslation('finance')
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  const items = [
    {
      key: 'collected',
      label: t('kpi.collected'),
      value: totals.collected,
      previous: previous.collected,
      note: null,
    },
    {
      key: 'billed',
      label: t('kpi.billed'),
      value: totals.billed,
      previous: previous.billed,
      note: null,
    },
    {
      key: 'outstandingDebt',
      label: t('kpi.outstandingDebt'),
      value: totals.outstandingDebt,
      previous: null,
      note: t('kpi.debtors', { count: totals.debtorsCount }),
    },
  ]

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const change = percentChange(item.value, item.previous)
        return (
          <Card className="flex flex-col gap-1 p-4" key={item.key}>
            <dt className="text-caption text-text-secondary">{item.label}</dt>
            <dd className="text-title2 text-text tabular-nums">{money(item.value)}</dd>
            {change === null ? null : (
              <dd className="flex flex-wrap items-center gap-x-1 text-caption text-text-secondary">
                <ChangeIcon change={change} />
                <span className="tabular-nums">
                  {change > 0 ? '+' : ''}
                  {change}%
                </span>
                <span className="text-text-tertiary">{t('kpi.vsPrevious')}</span>
              </dd>
            )}
            {item.note === null ? null : (
              <dd className="text-caption text-text-secondary">{item.note}</dd>
            )}
          </Card>
        )
      })}
    </dl>
  )
}

function ChangeIcon({ change }: { change: number }) {
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus
  return <Icon aria-hidden="true" className="size-4 shrink-0" />
}
