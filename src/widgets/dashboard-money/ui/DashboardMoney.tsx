import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { financeQueries } from '@/entities/finance'
import type { CalendarDate } from '@/shared/lib/calendarDate'
import { formatSom } from '@/shared/lib/money'
import { Card, QueryBoundary, Skeleton } from '@/shared/ui'

export interface DashboardMoneyProps {
  clinicId: string
  today: CalendarDate
}

/**
 * Today's money at a glance: what came in, the work done, and what patients
 * still owe. The finance page has the detail; this only answers "how is today going".
 */
export function DashboardMoney({ clinicId, today }: DashboardMoneyProps) {
  const { t, i18n } = useTranslation(['dashboard', 'finance', 'common'])
  const query = useQuery(
    financeQueries.overview(clinicId, { from: today, to: today, bucket: 'day' }),
  )
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <QueryBoundary
      // The queue below is the screen's job; a failed money strip must not take it down.
      error={() => null}
      loading={
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      }
      query={query}
    >
      {(overview) => {
        const items = [
          {
            key: 'collected',
            label: t('dashboard:money.collected'),
            value: overview.totals.collected,
          },
          { key: 'billed', label: t('dashboard:money.billed'), value: overview.totals.billed },
          {
            key: 'debt',
            label: t('dashboard:money.debt'),
            value: overview.totals.outstandingDebt,
            note: t('finance:kpi.debtors', { count: overview.totals.debtorsCount }),
          },
        ]
        return (
          <section aria-label={t('dashboard:money.title')} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-headline text-text">{t('dashboard:money.title')}</h2>
              <Link className="text-callout text-accent-text hover:underline" to="/finance">
                {t('dashboard:money.more')}
              </Link>
            </div>
            <dl className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              {items.map((item) => (
                // One line per figure on a phone, so three sums do not push the queue off screen.
                <Card
                  className="flex flex-col gap-1 p-4 max-sm:flex-row max-sm:flex-wrap max-sm:items-baseline max-sm:justify-between max-sm:p-3"
                  key={item.key}
                >
                  <dt className="text-caption text-text-secondary">{item.label}</dt>
                  <dd className="text-title2 text-text tabular-nums max-sm:text-headline">
                    {money(item.value)}
                  </dd>
                  {item.note === undefined ? null : (
                    <dd className="text-caption text-text-secondary max-sm:w-full">{item.note}</dd>
                  )}
                </Card>
              ))}
            </dl>
          </section>
        )
      }}
    </QueryBoundary>
  )
}
