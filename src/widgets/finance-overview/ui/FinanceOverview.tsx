import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type FinanceOverview as FinanceOverviewData, financeQueries } from '@/entities/finance'
import { clinicNow } from '@/shared/lib/datetime'
import { formatSom } from '@/shared/lib/money'
import {
  bucketLabel,
  percentOf,
  REPORT_PERIODS,
  type ReportPeriod,
  rangeOf,
} from '@/shared/lib/report'
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
import { FinanceKpis } from './FinanceKpis'
import { ProfitKpis } from './ProfitKpis'

export interface FinanceOverviewProps {
  clinicId: string
  /** All-branches mode: doctors are named with their branch. */
  showBranch: boolean
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
}

/** How many services the ranking shows before the tail stops being informative. */
const TOP_SERVICES = 6

export function FinanceOverview({
  clinicId,
  showBranch,
  period,
  onPeriodChange,
}: FinanceOverviewProps) {
  const { t } = useTranslation('finance')
  // The clinic's day, not the browser's (§14): "last 7 days" ends there.
  const range = rangeOf(period, clinicNow().date)
  const query = useQuery(financeQueries.overview(clinicId, range))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label={t('period.label')}
          className="w-auto shrink-0"
          onValueChange={(value) => onPeriodChange(value as ReportPeriod)}
          options={REPORT_PERIODS.map((value) => ({
            value,
            label: t(`period.${value}`),
          }))}
          size="sm"
          value={period}
        />
      </div>

      <QueryBoundary
        empty={
          <EmptyState
            description={t('empty.description')}
            icon={<Wallet aria-hidden="true" className="size-8" />}
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
          data.totals.billed === 0 &&
          data.totals.collected === 0 &&
          data.totals.expenses === 0 &&
          data.totals.outstandingDebt === 0
        }
        loading={<OverviewSkeleton />}
        query={query}
      >
        {(data) => <OverviewContent data={data} showBranch={showBranch} />}
      </QueryBoundary>
    </div>
  )
}

function OverviewContent({ data, showBranch }: { data: FinanceOverviewData; showBranch: boolean }) {
  const { t, i18n } = useTranslation('finance')
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <div className="flex flex-col gap-6">
      <FinanceKpis previous={data.previousTotals} totals={data.totals} />
      <ProfitKpis previous={data.previousTotals} totals={data.totals} />

      <ChartCard description={t('charts.revenue.description')} title={t('charts.revenue.title')}>
        <BarChart
          paired
          data={data.series.map((point) => ({
            key: point.start,
            label: bucketLabel(point.start, data.range.bucket, i18n.language),
            value: point.billed,
            part: point.collected,
          }))}
          formatValue={money}
          label={t('charts.revenue.title')}
          partLabel={t('charts.revenue.collected')}
          valueLabel={t('charts.revenue.billed')}
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard description={t('charts.methods.description')} title={t('charts.methods.title')}>
          <BarList
            formatValue={(amount) =>
              `${money(amount)} · ${percentOf(amount, data.totals.collected)}%`
            }
            items={[...data.paymentMethods]
              .sort((a, b) => b.amount - a.amount)
              .map((row) => ({
                key: row.method,
                label: t(`methods.${row.method}`),
                value: row.amount,
              }))}
            label={t('charts.methods.title')}
          />
        </ChartCard>

        <ChartCard description={t('charts.doctors.description')} title={t('charts.doctors.title')}>
          <BarList
            formatValue={money}
            items={[...data.doctors]
              .sort((a, b) => b.collected - a.collected)
              .map((row) => ({
                key: row.doctorId,
                label: showBranch ? `${row.doctorName} · ${row.clinicName}` : row.doctorName,
                value: row.collected,
              }))}
            label={t('charts.doctors.title')}
          />
        </ChartCard>
      </div>

      <ChartCard description={t('charts.services.description')} title={t('charts.services.title')}>
        <BarList
          formatValue={money}
          items={data.services.slice(0, TOP_SERVICES).map((row) => ({
            key: row.serviceId,
            label: row.serviceName,
            value: row.billed,
          }))}
          label={t('charts.services.title')}
        />
      </ChartCard>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
