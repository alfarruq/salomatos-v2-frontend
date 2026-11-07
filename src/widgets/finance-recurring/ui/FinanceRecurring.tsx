import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type CalendarMonth, expenseQueries } from '@/entities/expense'
import { monthLabel } from '@/shared/lib/calendarMonth'
import { formatSom } from '@/shared/lib/money'
import { Card, EmptyState, ErrorState, MonthSwitcher, QueryBoundary, Skeleton } from '@/shared/ui'
import { DueList } from './DueList'
import { RecurringTemplates } from './RecurringTemplates'

export interface FinanceRecurringProps {
  clinicId: string
  month: CalendarMonth
  onMonthChange: (month: CalendarMonth) => void
}

/**
 * The month's bills against what was really paid. Templates only remind:
 * every payment is confirmed by hand and posted as an ordinary expense.
 */
export function FinanceRecurring({ clinicId, month, onMonthChange }: FinanceRecurringProps) {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  const dueQuery = useQuery(expenseQueries.due(clinicId, month))
  const label = monthLabel(month, i18n.language)
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <div className="flex flex-col gap-6">
      <MonthSwitcher
        currentLabel={t('expenses:recurring.month.current')}
        locale={i18n.language}
        month={month}
        nextLabel={t('expenses:recurring.month.next')}
        onMonthChange={onMonthChange}
        previousLabel={t('expenses:recurring.month.previous')}
      />

      <QueryBoundary
        empty={
          <EmptyState
            description={t('expenses:recurring.empty.description')}
            icon={<CalendarClock aria-hidden="true" className="size-8" />}
            title={t('expenses:recurring.empty.title')}
          />
        }
        error={({ retry }) => (
          <ErrorState
            description={t('expenses:error.description')}
            retryLabel={t('common:action.retry')}
            title={t('expenses:recurring.error')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={(due) => due.items.length === 0}
        loading={<DueSkeleton />}
        query={dueQuery}
      >
        {(due) => (
          <div className="flex flex-col gap-6">
            <dl className="grid gap-3 sm:grid-cols-3">
              {(['expected', 'paid', 'remaining'] as const).map((key) => (
                <Card className="flex flex-col gap-1 p-4" key={key}>
                  <dt className="text-caption text-text-secondary">
                    {t(`expenses:recurring.totals.${key}`)}
                  </dt>
                  <dd className="text-title2 text-text tabular-nums">{money(due.totals[key])}</dd>
                </Card>
              ))}
            </dl>
            <DueList clinicId={clinicId} due={due} monthLabel={label} />
          </div>
        )}
      </QueryBoundary>

      <RecurringTemplates clinicId={clinicId} />
    </div>
  )
}

function DueSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton className="h-24 rounded-card" key={key} />
        ))}
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  )
}
