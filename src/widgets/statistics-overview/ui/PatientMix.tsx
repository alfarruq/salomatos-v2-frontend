import { useTranslation } from 'react-i18next'
import type { StatsTotals } from '@/entities/stats'
import { percentOf } from '@/shared/lib/report'
import { LegendSwatch } from '@/shared/ui'

/** New against returning patients: one bar split in two, with both numbers spelled out. */
export function PatientMix({ totals }: { totals: StatsTotals }) {
  const { t, i18n } = useTranslation('statistics')
  const number = new Intl.NumberFormat(i18n.language)
  const all = totals.newPatients + totals.returningPatients
  const newShare = percentOf(totals.newPatients, all)

  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden="true" className="flex h-3 gap-1 overflow-hidden rounded-full">
        {totals.newPatients === 0 ? null : (
          <div className="bg-accent" style={{ width: `${newShare}%` }} />
        )}
        {totals.returningPatients === 0 ? null : <div className="flex-1 bg-accent/35" />}
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-callout">
        <div className="flex items-center gap-2">
          <dt className="text-text-secondary">
            <LegendSwatch className="bg-accent" label={t('charts.patients.new')} />
          </dt>
          <dd className="text-text tabular-nums">
            {number.format(totals.newPatients)} · {newShare}%
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-text-secondary">
            <LegendSwatch className="bg-accent/35" label={t('charts.patients.returning')} />
          </dt>
          <dd className="text-text tabular-nums">
            {number.format(totals.returningPatients)} · {all === 0 ? 0 : 100 - newShare}%
          </dd>
        </div>
      </dl>
    </div>
  )
}
