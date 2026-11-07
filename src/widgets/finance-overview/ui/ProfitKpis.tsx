import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FinanceIncomeTotals, FinanceTotals } from '@/entities/finance'
import { formatSom } from '@/shared/lib/money'
import { percentChange, percentOf } from '@/shared/lib/report'
import { Card } from '@/shared/ui'

export interface ProfitKpisProps {
  totals: FinanceTotals
  previous: FinanceIncomeTotals
}

/**
 * Cash basis: money in minus money out in the same window, so profit is what
 * actually stayed with the clinic, not what it billed. The server leaves
 * profit out for a viewer who may not see pay: without it the difference
 * proves nothing.
 */
export function ProfitKpis({ totals, previous }: ProfitKpisProps) {
  const { t, i18n } = useTranslation('finance')
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  const items = [
    {
      key: 'expenses',
      value: totals.expenses,
      change: percentChange(totals.expenses, previous.expenses),
      note:
        totals.profit === null
          ? t('profit.withoutPayroll')
          : totals.collected > 0
            ? t('profit.expensesNote', { percent: percentOf(totals.expenses, totals.collected) })
            : null,
    },
    ...(totals.profit === null
      ? []
      : [
          {
            key: 'profit',
            value: totals.profit,
            // A change against a loss reads backwards, so it is only shown between two profits.
            change:
              previous.profit !== null && previous.profit > 0
                ? percentChange(totals.profit, previous.profit)
                : null,
            note:
              totals.collected > 0
                ? t('profit.margin', { percent: percentOf(totals.profit, totals.collected) })
                : null,
          },
        ]),
  ]

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Card className="flex flex-col gap-1 p-4" key={item.key}>
          <dt className="text-caption text-text-secondary">{t(`profit.${item.key}`)}</dt>
          <dd className="text-title2 text-text tabular-nums">{money(item.value)}</dd>
          {item.change === null ? null : (
            <dd className="flex flex-wrap items-center gap-x-1 text-caption text-text-secondary">
              <Change change={item.change} />
              <span className="tabular-nums">
                {item.change > 0 ? '+' : ''}
                {item.change}%
              </span>
              <span className="text-text-tertiary">{t('kpi.vsPrevious')}</span>
            </dd>
          )}
          {item.note === null ? null : (
            <dd className="text-caption text-text-secondary">{item.note}</dd>
          )}
        </Card>
      ))}
    </dl>
  )
}

function Change({ change }: { change: number }) {
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus
  return <Icon aria-hidden="true" className="size-4 shrink-0" />
}
