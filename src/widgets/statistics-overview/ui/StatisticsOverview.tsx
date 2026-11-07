import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STATS_PERIODS, type StatsOverview, type StatsPeriod, statsQueries } from '@/entities/stats'
import { clinicNow } from '@/shared/lib/datetime'
import { bucketLabel, rangeOf } from '@/shared/lib/report'
import {
  BarChart,
  BarList,
  ChartCard,
  EmptyState,
  ErrorState,
  QueryBoundary,
  Select,
  Skeleton,
} from '@/shared/ui'
import { BusyHoursHeatmap } from './BusyHoursHeatmap'
import { Counters } from './Counters'
import { KpiTiles } from './KpiTiles'
import { PatientMix } from './PatientMix'
import { TreatmentsSection } from './TreatmentsSection'

export interface StatisticsOverviewProps {
  clinicId: string
  /** All-branches mode: doctors are named with their branch. */
  showBranch: boolean
  period: StatsPeriod
  onPeriodChange: (period: StatsPeriod) => void
}

export function StatisticsOverview({
  clinicId,
  showBranch,
  period,
  onPeriodChange,
}: StatisticsOverviewProps) {
  const { t } = useTranslation('statistics')
  // The clinic's day, not the browser's (§14): "last 7 days" ends there.
  const range = rangeOf(period, clinicNow().date)
  const query = useQuery(statsQueries.overview(clinicId, range))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label={t('period.label')}
          className="w-auto shrink-0"
          onValueChange={(value) => onPeriodChange(value as StatsPeriod)}
          options={STATS_PERIODS.map((value) => ({ value, label: t(`period.${value}`) }))}
          size="sm"
          value={period}
        />
      </div>

      <QueryBoundary
        empty={
          <EmptyState
            description={t('empty.description')}
            icon={<BarChart3 aria-hidden="true" className="size-8" />}
            title={t('empty.title')}
          />
        }
        error={({ retry }) => (
          <ErrorState
            description={t('error.description')}
            retryLabel={t('common:action.retry')}
            title={t('error.title')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={(data) =>
          data.totals.appointments === 0 &&
          data.totals.cancellations === 0 &&
          data.totals.treatmentsCompleted === 0
        }
        loading={<OverviewSkeleton />}
        query={query}
      >
        {(data) => <OverviewContent data={data} showBranch={showBranch} />}
      </QueryBoundary>
    </div>
  )
}

function OverviewContent({ data, showBranch }: { data: StatsOverview; showBranch: boolean }) {
  const { t, i18n } = useTranslation('statistics')

  return (
    <div className="flex flex-col gap-6">
      <KpiTiles previous={data.previousTotals} totals={data.totals} />

      <h2 className="text-title2 text-text">{t('appointments.title')}</h2>

      <Counters
        items={[
          { key: 'noShows', label: t('appointments.noShows'), value: data.totals.noShows },
          {
            key: 'cancellations',
            label: t('appointments.cancellations'),
            value: data.totals.cancellations,
          },
        ]}
      />

      <ChartCard title={t('charts.appointments.title')}>
        <BarChart
          data={data.appointmentsSeries.map((point) => ({
            key: point.start,
            label: bucketLabel(point.start, data.range.bucket, i18n.language),
            value: point.total,
            part: point.completed,
          }))}
          label={t('charts.appointments.title')}
          partLabel={t('charts.appointments.completed')}
          valueLabel={t('charts.appointments.booked')}
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard description={t('charts.doctors.description')} title={t('charts.doctors.title')}>
          <BarList
            items={[...data.doctors]
              .sort((a, b) => b.appointments - a.appointments)
              .map((row) => ({
                key: row.doctorId,
                label: showBranch ? `${row.doctorName} · ${row.clinicName}` : row.doctorName,
                value: row.appointments,
              }))}
            label={t('charts.doctors.title')}
          />
        </ChartCard>

        <ChartCard title={t('charts.patients.title')}>
          <PatientMix totals={data.totals} />
        </ChartCard>
      </div>

      <ChartCard description={t('charts.busy.description')} title={t('charts.busy.title')}>
        <BusyHoursHeatmap slots={data.busySlots} />
      </ChartCard>

      <TreatmentsSection data={data} showBranch={showBranch} />
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton className="h-24 rounded-card" key={key} />
        ))}
      </div>
      <Skeleton className="h-80 rounded-card" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  )
}
