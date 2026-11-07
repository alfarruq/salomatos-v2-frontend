import { useTranslation } from 'react-i18next'
import type { StatsOverview } from '@/entities/stats'
import { bucketLabel } from '@/shared/lib/report'
import { BarChart, BarList, ChartCard } from '@/shared/ui'
import { Counters } from './Counters'
import { ToothHeatmap } from './ToothHeatmap'

/** How many services the ranking shows before the tail stops being informative. */
const TOP_SERVICES = 6

/** Everything about treatments: volume, who does them, what and on which teeth. */
export function TreatmentsSection({
  data,
  showBranch,
}: {
  data: StatsOverview
  showBranch: boolean
}) {
  const { t, i18n } = useTranslation('statistics')

  const counters = [
    { key: 'completed', label: t('treatments.completed'), value: data.totals.treatmentsCompleted },
    {
      key: 'plansAccepted',
      label: t('treatments.plansAccepted'),
      value: data.totals.plansAccepted,
    },
  ]

  return (
    <section aria-labelledby="stats-treatments" className="flex flex-col gap-6">
      <h2 className="text-title2 text-text" id="stats-treatments">
        {t('treatments.title')}
      </h2>

      <Counters items={counters} />

      <ChartCard title={t('charts.treatments.title')}>
        <BarChart
          data={data.treatmentsSeries.map((point) => ({
            key: point.start,
            label: bucketLabel(point.start, data.range.bucket, i18n.language),
            value: point.completed,
          }))}
          label={t('charts.treatments.title')}
          valueLabel={t('treatments.completed')}
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          description={t('charts.treatmentDoctors.description')}
          title={t('charts.treatmentDoctors.title')}
        >
          <BarList
            items={[...data.doctors]
              .sort((a, b) => b.treatmentsCompleted - a.treatmentsCompleted)
              .map((row) => ({
                key: row.doctorId,
                label: showBranch ? `${row.doctorName} · ${row.clinicName}` : row.doctorName,
                value: row.treatmentsCompleted,
              }))}
            label={t('charts.treatmentDoctors.title')}
          />
        </ChartCard>

        <ChartCard
          description={t('charts.services.description')}
          title={t('charts.services.title')}
        >
          <BarList
            items={[...data.treatmentTypes]
              .sort((a, b) => b.count - a.count)
              .slice(0, TOP_SERVICES)
              .map((row) => ({
                key: row.treatmentTypeId,
                label: row.treatmentTypeName,
                value: row.count,
              }))}
            label={t('charts.services.title')}
          />
        </ChartCard>
      </div>

      <ChartCard description={t('charts.teeth.description')} title={t('charts.teeth.title')}>
        <ToothHeatmap teeth={data.teeth} />
      </ChartCard>
    </section>
  )
}
