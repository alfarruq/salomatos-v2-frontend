import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { StatsTotals } from '@/entities/stats'
import { percentChange, percentOf } from '@/shared/lib/report'
import { Card } from '@/shared/ui'

/**
 * Headline figures, each with its change against the previous window. The
 * change is told by icon and sign, not colour: more appointments is not
 * "good" in the way status colours would claim.
 */
export function KpiTiles({
  totals,
  previous,
}: {
  totals: StatsTotals
  previous: StatsTotals | null
}) {
  const { t, i18n } = useTranslation('statistics')
  const number = new Intl.NumberFormat(i18n.language)

  const rate = percentOf(totals.appointmentsCompleted, totals.appointments)
  const previousRate =
    previous === null ? null : percentOf(previous.appointmentsCompleted, previous.appointments)

  const items = [
    {
      key: 'appointments',
      label: t('kpi.appointments'),
      value: number.format(totals.appointments),
      change: percentChange(totals.appointments, previous?.appointments ?? null),
      unit: '%',
    },
    {
      key: 'completionRate',
      label: t('kpi.completionRate'),
      value: `${rate}%`,
      // A rate's change is told in points, not in percent of itself.
      change: previousRate === null ? null : rate - previousRate,
      unit: t('kpi.points'),
    },
    {
      key: 'newPatients',
      label: t('kpi.newPatients'),
      value: number.format(totals.newPatients),
      change: percentChange(totals.newPatients, previous?.newPatients ?? null),
      unit: '%',
    },
    {
      key: 'treatmentsCompleted',
      label: t('kpi.treatmentsCompleted'),
      value: number.format(totals.treatmentsCompleted),
      change: percentChange(totals.treatmentsCompleted, previous?.treatmentsCompleted ?? null),
      unit: '%',
    },
  ]

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card className="flex flex-col gap-1 p-4" key={item.key}>
          <dt className="text-caption text-text-secondary">{item.label}</dt>
          <dd className="text-title2 text-text tabular-nums">{item.value}</dd>
          {item.change === null ? null : (
            <dd className="flex flex-wrap items-center gap-x-1 text-caption text-text-secondary">
              <ChangeIcon change={item.change} />
              <span className="tabular-nums">
                {item.change > 0 ? '+' : ''}
                {item.change}
                {item.unit === '%' ? '%' : ` ${item.unit}`}
              </span>
              <span className="text-text-tertiary max-lg:basis-full">{t('kpi.vsPrevious')}</span>
            </dd>
          )}
        </Card>
      ))}
    </dl>
  )
}

function ChangeIcon({ change }: { change: number }) {
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus
  return <Icon aria-hidden="true" className="size-4 shrink-0" />
}
