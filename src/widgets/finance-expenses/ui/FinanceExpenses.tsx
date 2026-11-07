import { useQuery } from '@tanstack/react-query'
import { Plus, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type ExpenseCategory, type ExpenseSummary, expenseQueries } from '@/entities/expense'
import { Can } from '@/entities/session'
import { CreateExpenseDialog } from '@/features/expense-create'
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
  Button,
  ChartCard,
  EmptyState,
  ErrorState,
  QueryBoundary,
  Select,
  Skeleton,
} from '@/shared/ui'
import { ExpenseJournal } from './ExpenseJournal'
import { ExpenseKpis } from './ExpenseKpis'

export interface ExpenseViewState {
  period: ReportPeriod
  category: ExpenseCategory | null
  page: number
}

export interface FinanceExpensesProps {
  clinicId: string
  view: ExpenseViewState
  onViewChange: (view: ExpenseViewState) => void
}

export function FinanceExpenses({ clinicId, view, onViewChange }: FinanceExpensesProps) {
  const { t } = useTranslation(['expenses', 'finance', 'common'])
  const [isCreateOpen, setCreateOpen] = useState(false)
  // The clinic's day, not the browser's (§14).
  const range = rangeOf(view.period, clinicNow().date)
  const summaryQuery = useQuery(expenseQueries.summary(clinicId, range))

  const openCreate = () => setCreateOpen(true)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label={t('finance:period.label')}
          className="w-auto shrink-0"
          // A new period starts the journal from its first page.
          onValueChange={(value) =>
            onViewChange({ ...view, period: value as ReportPeriod, page: 1 })
          }
          options={REPORT_PERIODS.map((value) => ({
            value,
            label: t(`finance:period.${value}`),
          }))}
          size="sm"
          value={view.period}
        />
        <Can permission="expense:manage">
          <Button
            iconLeft={<Plus aria-hidden="true" className="size-4" />}
            onClick={openCreate}
            size="sm"
            variant="primary"
          >
            {t('expenses:create.open')}
          </Button>
        </Can>
      </div>

      <QueryBoundary
        empty={
          <EmptyState
            action={
              <Can permission="expense:manage">
                <Button onClick={openCreate} variant="primary">
                  {t('expenses:create.open')}
                </Button>
              </Can>
            }
            description={t('expenses:empty.description')}
            icon={<Receipt aria-hidden="true" className="size-8" />}
            title={t('expenses:empty.title')}
          />
        }
        error={({ retry }) => (
          <ErrorState
            description={t('expenses:error.description')}
            retryLabel={t('common:action.retry')}
            title={t('expenses:error.title')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={(summary) => summary.totals.count === 0}
        loading={<SummarySkeleton />}
        query={summaryQuery}
      >
        {(summary) => <SummaryContent summary={summary} />}
      </QueryBoundary>

      <ExpenseJournal
        clinicId={clinicId}
        filters={{ from: range.from, to: range.to, category: view.category, page: view.page }}
        onCategoryChange={(category) => onViewChange({ ...view, category, page: 1 })}
        onPageChange={(page) => onViewChange({ ...view, page })}
      />

      <CreateExpenseDialog clinicId={clinicId} onOpenChange={setCreateOpen} open={isCreateOpen} />
    </div>
  )
}

function SummaryContent({ summary }: { summary: ExpenseSummary }) {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <div className="flex flex-col gap-6">
      <ExpenseKpis previous={summary.previousTotals} totals={summary.totals} />

      <div className="grid gap-6 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          description={t('expenses:charts.trend.description')}
          title={t('expenses:charts.trend.title')}
        >
          <BarChart
            data={summary.series.map((point) => ({
              key: point.start,
              label: bucketLabel(point.start, summary.range.bucket, i18n.language),
              value: point.amount,
            }))}
            formatValue={money}
            label={t('expenses:charts.trend.title')}
            valueLabel={t('expenses:kpi.total')}
          />
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          description={t('expenses:charts.categories.description')}
          title={t('expenses:charts.categories.title')}
        >
          <BarList
            formatValue={(amount) =>
              `${money(amount)} · ${percentOf(amount, summary.totals.total)}%`
            }
            items={[...summary.byCategory]
              .sort((a, b) => b.amount - a.amount)
              .map((row) => ({
                key: row.category,
                label: t(`expenses:categories.${row.category}`),
                value: row.amount,
              }))}
            label={t('expenses:charts.categories.title')}
          />
        </ChartCard>
      </div>
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton className="h-28 rounded-card" key={key} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-card lg:col-span-3" />
        <Skeleton className="h-80 rounded-card lg:col-span-2" />
      </div>
    </div>
  )
}
