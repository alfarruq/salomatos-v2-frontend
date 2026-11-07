import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CompensationTerms,
  expenseQueries,
  type Payroll,
  type PayrollRow,
} from '@/entities/expense'
import { CompensationDialog } from '@/features/doctor-compensation-set'
import { PayDoctorShareDialog } from '@/features/doctor-share-pay'
import type { CalendarMonth } from '@/shared/lib/calendarMonth'
import { cn } from '@/shared/lib/cn'
import { formatSom } from '@/shared/lib/money'
import {
  Button,
  Card,
  ChartCard,
  EmptyState,
  ErrorState,
  MonthSwitcher,
  QueryBoundary,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui'

export interface FinancePayrollProps {
  clinicId: string
  month: CalendarMonth
  onMonthChange: (month: CalendarMonth) => void
}

/**
 * What each doctor earned this month under their terms, what was paid, and
 * what is still owed. The page only suggests: every payout is entered by hand
 * and is an ordinary "doctor share" expense.
 */
export function FinancePayroll({ clinicId, month, onMonthChange }: FinancePayrollProps) {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  const query = useQuery(expenseQueries.payroll(clinicId, month))

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
            description={t('expenses:payroll.empty.description')}
            icon={<Users aria-hidden="true" className="size-8" />}
            title={t('expenses:payroll.empty.title')}
          />
        }
        error={({ retry }) => (
          <ErrorState
            description={t('expenses:error.description')}
            retryLabel={t('common:action.retry')}
            title={t('expenses:payroll.error')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={(payroll) => payroll.rows.length === 0}
        loading={<PayrollSkeleton />}
        query={query}
      >
        {(payroll) => <PayrollContent clinicId={clinicId} payroll={payroll} />}
      </QueryBoundary>
    </div>
  )
}

function PayrollContent({ clinicId, payroll }: { clinicId: string; payroll: Payroll }) {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  const [paying, setPaying] = useState<PayrollRow | null>(null)
  const [editing, setEditing] = useState<PayrollRow | null>(null)
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-3 sm:grid-cols-3">
        {(['accrued', 'paid', 'balance'] as const).map((key) => (
          <Card className="flex flex-col gap-1 p-4" key={key}>
            <dt className="text-caption text-text-secondary">
              {t(`expenses:payroll.totals.${key}`)}
            </dt>
            <dd className="text-title2 text-text tabular-nums">{money(payroll.totals[key])}</dd>
          </Card>
        ))}
      </dl>

      <ChartCard
        description={t('expenses:payroll.table.description')}
        title={t('expenses:payroll.table.title')}
      >
        <Table density="compact">
          <TableHeader>
            <TableRow>
              <TableHead>{t('expenses:payroll.table.doctor')}</TableHead>
              <TableHead align="right" className="max-lg:hidden">
                {t('expenses:payroll.table.base')}
              </TableHead>
              <TableHead align="right" className="max-md:hidden">
                {t('expenses:payroll.table.accrued')}
              </TableHead>
              <TableHead align="right" className="max-md:hidden">
                {t('expenses:payroll.table.paid')}
              </TableHead>
              <TableHead align="right" className="max-sm:hidden">
                {t('expenses:payroll.table.balance')}
              </TableHead>
              <TableHead className="max-sm:hidden">
                <span className="sr-only">{t('expenses:journal.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payroll.rows.map((row) => (
              <TableRow key={row.doctorId}>
                <TableCell className="max-lg:whitespace-normal max-md:whitespace-normal">
                  <div className="flex flex-col">
                    <span className="text-text">{row.doctorName}</span>
                    <span className="text-caption text-text-secondary">
                      <CompensationTerms compensation={row.compensation} />
                    </span>
                    {/* Folded columns on narrow screens, so nothing needs a sideways scroll. */}
                    <span className="text-caption tabular-nums md:hidden">
                      {t('expenses:payroll.table.accruedPaid', {
                        accrued: money(row.accrued),
                        paid: money(row.paid),
                      })}
                    </span>
                    <span className="font-medium tabular-nums text-text sm:hidden">
                      {t('expenses:payroll.table.balanceShort', { amount: money(row.balance) })}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                      <RowActions
                        onEdit={() => setEditing(row)}
                        onPay={() => setPaying(row)}
                        row={row}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell align="right" className="whitespace-nowrap max-lg:hidden" isNumeric>
                  <div className="flex flex-col items-end">
                    <span>{money(row.baseAmount)}</span>
                    <span className="text-caption text-text-tertiary">
                      {t('expenses:payroll.table.billedCollected', {
                        billed: money(row.billed),
                        collected: money(row.collected),
                      })}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  align="right"
                  className="whitespace-nowrap text-text max-md:hidden"
                  isNumeric
                >
                  {money(row.accrued)}
                </TableCell>
                <TableCell align="right" className="whitespace-nowrap max-md:hidden" isNumeric>
                  {money(row.paid)}
                </TableCell>
                <TableCell align="right" className="whitespace-nowrap max-sm:hidden" isNumeric>
                  <div className="flex flex-col items-end">
                    <span className={cn('font-medium', row.balance > 0 && 'text-text')}>
                      {money(row.balance)}
                    </span>
                    {row.opening === 0 ? null : (
                      <span className="text-caption text-text-secondary">
                        {t('expenses:payroll.table.opening', { amount: money(row.opening) })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-sm:hidden">
                  <div className="flex justify-end gap-1">
                    <RowActions
                      onEdit={() => setEditing(row)}
                      onPay={() => setPaying(row)}
                      row={row}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>

      {paying === null ? null : (
        <PayDoctorShareDialog
          clinicId={clinicId}
          month={payroll.month}
          onOpenChange={(open) => {
            if (!open) setPaying(null)
          }}
          open
          row={paying}
        />
      )}

      {editing === null ? null : (
        <CompensationDialog
          clinicId={clinicId}
          month={payroll.month}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          open
          row={editing}
        />
      )}
    </div>
  )
}

function RowActions({
  row,
  onPay,
  onEdit,
}: {
  row: PayrollRow
  onPay: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation('expenses')
  return (
    <>
      {row.balance > 0 ? (
        <Button
          aria-label={`${t('payroll.pay.open')} — ${row.doctorName}`}
          onClick={onPay}
          size="sm"
          variant="primary"
        >
          {t('payroll.pay.open')}
        </Button>
      ) : null}
      <Button
        aria-label={`${t('payroll.terms.open')} — ${row.doctorName}`}
        onClick={onEdit}
        size="sm"
        variant="ghost"
      >
        {t('payroll.terms.open')}
      </Button>
    </>
  )
}

function PayrollSkeleton() {
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
