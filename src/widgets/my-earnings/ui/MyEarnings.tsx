import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CompensationTerms,
  EARNINGS_STATUSES,
  type Earnings,
  type EarningsStatus,
  expenseQueries,
} from '@/entities/expense'
import type { CalendarMonth } from '@/shared/lib/calendarMonth'
import { formatDate } from '@/shared/lib/datetime'
import { formatSom } from '@/shared/lib/money'
import {
  Badge,
  Card,
  ChartCard,
  EmptyState,
  ErrorState,
  MonthSwitcher,
  QueryBoundary,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui'

export interface MyEarningsProps {
  clinicId: string
  month: CalendarMonth
  onMonthChange: (month: CalendarMonth) => void
}

const EMPTY = '—'
type StatusFilter = EarningsStatus | 'all'
const STATUS_FILTERS: readonly StatusFilter[] = ['all', ...EARNINGS_STATUSES]

/**
 * A doctor's own month: what is already earned, what waits on patients'
 * payments, and the work behind both. The server computes every sum.
 */
export function MyEarnings({ clinicId, month, onMonthChange }: MyEarningsProps) {
  const { t, i18n } = useTranslation(['earnings', 'expenses', 'common'])
  const query = useQuery(expenseQueries.myEarnings(clinicId, month))

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
        empty={null}
        error={({ retry }) => (
          <ErrorState
            description={t('expenses:error.description')}
            retryLabel={t('common:action.retry')}
            title={t('earnings:error')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        // The summary always has something to say, even "no terms yet".
        isEmpty={() => false}
        loading={<EarningsSkeleton />}
        query={query}
      >
        {(earnings) => <EarningsContent earnings={earnings} />}
      </QueryBoundary>
    </div>
  )
}

function EarningsContent({ earnings }: { earnings: Earnings }) {
  const { t, i18n } = useTranslation(['earnings', 'expenses', 'common'])
  const [status, setStatus] = useState<StatusFilter>('all')
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))
  const { summary } = earnings
  const lines =
    status === 'all' ? earnings.lines : earnings.lines.filter((line) => line.status === status)

  const cards = [
    { key: 'earned', value: summary.accrued, hint: t('earnings:totals.earnedHint') },
    { key: 'pending', value: summary.pendingShare, hint: t('earnings:totals.pendingHint') },
    { key: 'paid', value: summary.paid, hint: null },
    { key: 'balance', value: summary.balance, hint: null },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <p className="text-callout text-text-secondary">
        {t('earnings:terms')} <CompensationTerms compensation={summary.compensation} />
      </p>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card className="flex flex-col gap-1 p-4" key={card.key}>
            <dt className="text-caption text-text-secondary">{t(`earnings:totals.${card.key}`)}</dt>
            <dd className="text-title2 text-text tabular-nums">{money(card.value)}</dd>
            {card.hint === null ? null : (
              <dd className="text-caption text-text-tertiary">{card.hint}</dd>
            )}
          </Card>
        ))}
      </dl>

      <ChartCard description={t('earnings:lines.description')} title={t('earnings:lines.title')}>
        <div className="mb-3 flex justify-end">
          <Select
            aria-label={t('earnings:lines.filter')}
            className="w-auto"
            onValueChange={(value) => {
              const picked = STATUS_FILTERS.find((option) => option === value)
              if (picked !== undefined) setStatus(picked)
            }}
            options={STATUS_FILTERS.map((value) => ({
              value,
              label: t(`earnings:status.${value}`),
            }))}
            size="sm"
            value={status}
          />
        </div>

        {lines.length === 0 ? (
          <EmptyState
            description={t('earnings:lines.emptyDescription')}
            icon={<Wallet aria-hidden="true" className="size-8" />}
            title={t('earnings:lines.empty')}
          />
        ) : (
          <Table density="compact">
            <TableHeader>
              <TableRow>
                <TableHead>{t('earnings:lines.date')}</TableHead>
                <TableHead>{t('earnings:lines.patient')}</TableHead>
                <TableHead className="max-md:hidden">{t('earnings:lines.service')}</TableHead>
                <TableHead align="center" className="max-lg:hidden">
                  {t('earnings:lines.tooth')}
                </TableHead>
                <TableHead align="right" className="max-sm:hidden">
                  {t('earnings:lines.total')}
                </TableHead>
                <TableHead align="right" className="max-sm:hidden">
                  {t('earnings:lines.unpaid')}
                </TableHead>
                <TableHead>{t('earnings:lines.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.procedureId}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDate(line.performedAt, { locale: i18n.language })}
                  </TableCell>
                  <TableCell className="max-md:whitespace-normal">
                    <div className="flex flex-col">
                      {line.patientName === null ? (
                        EMPTY
                      ) : (
                        <Link
                          className="font-medium text-text hover:underline focus-visible:underline"
                          params={{ patientId: line.patientId }}
                          to="/patients/$patientId"
                        >
                          {line.patientName}
                        </Link>
                      )}
                      <span className="text-caption text-text-secondary md:hidden">
                        {line.serviceName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-md:hidden">{line.serviceName}</TableCell>
                  <TableCell align="center" className="tabular-nums max-lg:hidden">
                    {line.tooth ?? EMPTY}
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap max-sm:hidden" isNumeric>
                    {money(line.total)}
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap max-sm:hidden" isNumeric>
                    {line.unpaid === 0 ? EMPTY : money(line.unpaid)}
                  </TableCell>
                  <TableCell>
                    <Badge tone={line.status === 'completed' ? 'success' : 'warning'}>
                      {t(`earnings:status.${line.status}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ChartCard>
    </div>
  )
}

function EarningsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton className="h-24" key={n} />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
