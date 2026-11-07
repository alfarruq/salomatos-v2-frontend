import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ExpenseTotals } from '@/entities/expense'
import { formatSom } from '@/shared/lib/money'
import { percentChange, percentOf } from '@/shared/lib/report'
import { Card } from '@/shared/ui'

/**
 * The total with its change against the previous window, then the three kinds
 * of cost with their share of it. Change is told by icon and sign, not colour,
 * the same as on the overview tab.
 */
export function ExpenseKpis({
  totals,
  previous,
}: {
  totals: ExpenseTotals
  previous: ExpenseTotals | null
}) {
  const { t, i18n } = useTranslation('expenses')
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  const kinds = [
    { key: 'payroll', value: totals.payroll, previous: previous?.payroll ?? null },
    { key: 'fixed', value: totals.fixed, previous: previous?.fixed ?? null },
    { key: 'variable', value: totals.variable, previous: previous?.variable ?? null },
  ] as const

  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="flex flex-col gap-1 p-4">
        <dt className="text-caption text-text-secondary">{t('kpi.total')}</dt>
        <dd className="text-title2 text-text tabular-nums">{money(totals.total)}</dd>
        <Change change={percentChange(totals.total, previous?.total ?? null)} />
        <dd className="text-caption text-text-secondary">
          {t('kpi.entries', { count: totals.count })}
        </dd>
      </Card>

      {kinds.map((kind) => (
        <Card className="flex flex-col gap-1 p-4" key={kind.key}>
          <dt className="text-caption text-text-secondary">{t(`kinds.${kind.key}`)}</dt>
          <dd className="text-title2 text-text tabular-nums">{money(kind.value)}</dd>
          <Change change={percentChange(kind.value, kind.previous)} />
          <dd className="text-caption text-text-secondary">
            {t('kpi.share', { percent: percentOf(kind.value, totals.total) })}
          </dd>
        </Card>
      ))}
    </dl>
  )
}

function Change({ change }: { change: number | null }) {
  const { t } = useTranslation('expenses')
  if (change === null) return null

  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus
  return (
    <dd className="flex flex-wrap items-center gap-x-1 text-caption text-text-secondary">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="tabular-nums">
        {change > 0 ? '+' : ''}
        {change}%
      </span>
      <span className="text-text-tertiary">{t('kpi.vsPrevious')}</span>
    </dd>
  )
}
