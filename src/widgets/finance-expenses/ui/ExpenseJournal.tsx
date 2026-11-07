import { useQuery } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  type ExpenseFilters,
  expenseQueries,
} from '@/entities/expense'
import { Can } from '@/entities/session'
import { VoidExpenseDialog } from '@/features/expense-void'
import { PAGE_SIZE } from '@/shared/api/pagination'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { cn } from '@/shared/lib/cn'
import { formatSom } from '@/shared/lib/money'
import {
  Badge,
  Button,
  ChartCard,
  ErrorState,
  Pagination,
  QueryBoundary,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/shared/ui'

export interface ExpenseJournalProps {
  clinicId: string
  filters: ExpenseFilters
  onCategoryChange: (category: ExpenseCategory | null) => void
  onPageChange: (page: number) => void
}

/** Radix `Select` reserves `""` for "nothing picked", so "all" needs its own value. */
const ALL = 'all'

/**
 * Every entry in the period, newest first, voided ones included and marked:
 * the journal is the audit trail, the totals above are what counts.
 */
export function ExpenseJournal({
  clinicId,
  filters,
  onCategoryChange,
  onPageChange,
}: ExpenseJournalProps) {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  const [voiding, setVoiding] = useState<Expense | null>(null)
  const query = useQuery(expenseQueries.list(clinicId, filters))

  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <ChartCard description={t('expenses:journal.description')} title={t('expenses:journal.title')}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="expense-category-filter">
            {t('expenses:journal.categoryFilter')}
          </label>
          <Select
            className="w-auto"
            id="expense-category-filter"
            onValueChange={(value) =>
              onCategoryChange(value === ALL ? null : (value as ExpenseCategory))
            }
            options={[
              { value: ALL, label: t('expenses:journal.allCategories') },
              ...EXPENSE_CATEGORIES.map((value) => ({
                value,
                label: t(`expenses:categories.${value}`),
              })),
            ]}
            size="sm"
            value={filters.category ?? ALL}
          />
        </div>

        <QueryBoundary
          empty={
            <p className="py-8 text-center text-callout text-text-secondary">
              {filters.category === null
                ? t('expenses:journal.empty')
                : t('expenses:journal.emptyFiltered')}
            </p>
          }
          error={({ retry }) => (
            <ErrorState
              description={t('expenses:error.description')}
              retryLabel={t('common:action.retry')}
              title={t('expenses:error.title')}
              {...(retry === undefined ? {} : { onRetry: retry })}
            />
          )}
          isEmpty={(page) => page.results.length === 0}
          loading={
            <Table density="compact">
              <TableSkeleton columns={5} rows={PAGE_SIZE} />
            </Table>
          }
          query={query}
        >
          {(page) => (
            <>
              <div className="overflow-x-auto">
                <Table density="compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="max-sm:hidden">{t('expenses:journal.date')}</TableHead>
                      <TableHead>{t('expenses:journal.category')}</TableHead>
                      <TableHead className="max-sm:hidden">{t('expenses:journal.payee')}</TableHead>
                      <TableHead className="max-md:hidden">
                        {t('expenses:journal.method')}
                      </TableHead>
                      <TableHead className="max-lg:hidden">
                        {t('expenses:journal.enteredBy')}
                      </TableHead>
                      <TableHead align="right" className="max-sm:hidden">
                        {t('expenses:journal.amount')}
                      </TableHead>
                      <Can permission="expense:void">
                        <TableHead align="right">
                          <span className="sr-only">{t('expenses:journal.actions')}</span>
                        </TableHead>
                      </Can>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.results.map((expense) => (
                      <TableRow
                        className={cn(expense.isVoid && 'text-text-tertiary')}
                        key={expense.id}
                      >
                        <TableCell className="whitespace-nowrap tabular-nums max-sm:hidden">
                          {formatFixedDate(expense.date)}
                        </TableCell>
                        <TableCell className="max-md:whitespace-normal">
                          <div className="flex flex-col">
                            {/* On a phone the date and amount columns fold into this one. */}
                            <span className="text-caption tabular-nums sm:hidden">
                              {formatFixedDate(expense.date)}
                            </span>
                            <span className={cn(!expense.isVoid && 'text-text')}>
                              {t(`expenses:categories.${expense.category}`)}
                            </span>
                            {expense.doctorName === null ? null : (
                              <span className="text-caption text-text-secondary">
                                {expense.doctorName}
                              </span>
                            )}
                            <span
                              className={cn(
                                'font-medium tabular-nums sm:hidden',
                                expense.isVoid ? 'line-through' : 'text-text',
                              )}
                            >
                              {money(expense.amount)}
                            </span>
                            {expense.isVoid ? (
                              <Badge className="mt-1 self-start">
                                {t('expenses:journal.voided')}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-sm:hidden">
                          <div className="flex max-w-xs flex-col">
                            <span className="truncate">{expense.payee ?? '—'}</span>
                            {expense.isVoid && expense.voidReason !== null ? (
                              <span className="text-caption">
                                {t('expenses:journal.voidReason', { reason: expense.voidReason })}
                              </span>
                            ) : expense.note === null ? null : (
                              <span className="truncate text-caption text-text-secondary">
                                {expense.note}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-md:hidden">
                          {t(`expenses:methods.${expense.method}`)}
                        </TableCell>
                        <TableCell className="max-lg:hidden">{expense.createdBy ?? '—'}</TableCell>
                        <TableCell
                          align="right"
                          className={cn(
                            'whitespace-nowrap font-medium max-sm:hidden',
                            expense.isVoid ? 'line-through' : 'text-text',
                          )}
                          isNumeric
                        >
                          {money(expense.amount)}
                        </TableCell>
                        <Can permission="expense:void">
                          <TableCell align="right">
                            {/* A voided entry is final: a correction is a new entry. */}
                            {expense.isVoid ? null : (
                              <div className="flex justify-end gap-1">
                                <Button
                                  aria-label={`${t('expenses:void.submit')} — ${t(`expenses:categories.${expense.category}`)}, ${formatFixedDate(expense.date)}`}
                                  onClick={() => setVoiding(expense)}
                                  size="sm"
                                  variant="ghost"
                                >
                                  <Ban aria-hidden="true" className="size-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </Can>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                hasNext={page.hasNext}
                hasPrevious={page.hasPrevious}
                isLoading={query.isFetching}
                nextLabel={t('common:action.next')}
                onNext={() => onPageChange(filters.page + 1)}
                onPrevious={() => onPageChange(filters.page - 1)}
                previousLabel={t('common:action.previous')}
                summary={t('expenses:journal.pageSummary', {
                  total: page.count,
                  from: (filters.page - 1) * PAGE_SIZE + 1,
                  to: Math.min(filters.page * PAGE_SIZE, page.count),
                })}
              />
            </>
          )}
        </QueryBoundary>
      </div>

      {voiding === null ? null : (
        <VoidExpenseDialog
          clinicId={clinicId}
          expense={voiding}
          onOpenChange={(open) => {
            if (!open) setVoiding(null)
          }}
          open
        />
      )}
    </ChartCard>
  )
}
