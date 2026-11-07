import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DueExpense, DueMonth, DueStatus } from '@/entities/expense'
import { Can } from '@/entities/session'
import { PayDueDialog, SkipDueDialog } from '@/features/due-expense-settle'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { cn } from '@/shared/lib/cn'
import { formatSom } from '@/shared/lib/money'
import {
  Badge,
  type BadgeTone,
  Button,
  ChartCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui'

/** Overdue is a warning, not red: red is kept for deleting (§13). */
const STATUS_TONE: Record<DueStatus, BadgeTone> = {
  due: 'accent',
  overdue: 'warning',
  paid: 'success',
  skipped: 'neutral',
}

export interface DueListProps {
  clinicId: string
  due: DueMonth
  monthLabel: string
}

export function DueList({ clinicId, due, monthLabel }: DueListProps) {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  const [paying, setPaying] = useState<DueExpense | null>(null)
  const [skipping, setSkipping] = useState<DueExpense | null>(null)
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <ChartCard
      description={t('expenses:recurring.due.description')}
      title={t('expenses:recurring.due.title')}
    >
      <Table density="compact">
        <TableHeader>
          <TableRow>
            <TableHead className="max-sm:hidden">{t('expenses:recurring.due.date')}</TableHead>
            <TableHead>{t('expenses:recurring.due.name')}</TableHead>
            <TableHead className="max-md:hidden">{t('expenses:journal.category')}</TableHead>
            <TableHead align="right" className="max-sm:hidden">
              {t('expenses:journal.amount')}
            </TableHead>
            <TableHead className="max-sm:hidden">{t('expenses:recurring.due.status')}</TableHead>
            <Can permission="expense:manage">
              <TableHead align="right">
                <span className="sr-only">{t('expenses:journal.actions')}</span>
              </TableHead>
            </Can>
          </TableRow>
        </TableHeader>
        <TableBody>
          {due.items.map((item) => {
            const isOpen = item.status === 'due' || item.status === 'overdue'
            const shown = item.paidAmount ?? item.amount
            const status = (
              <Badge tone={STATUS_TONE[item.status]}>
                {t(`expenses:recurring.status.${item.status}`)}
              </Badge>
            )
            return (
              <TableRow
                className={cn(item.status === 'skipped' && 'text-text-tertiary')}
                key={item.recurringId}
              >
                <TableCell className="whitespace-nowrap tabular-nums max-sm:hidden">
                  {formatFixedDate(item.dueDate)}
                </TableCell>
                <TableCell className="max-md:whitespace-normal">
                  <div className="flex flex-col">
                    {/* On a phone the date, amount and status columns fold into this one. */}
                    <span className="text-caption tabular-nums sm:hidden">
                      {formatFixedDate(item.dueDate)}
                    </span>
                    <span className={cn(item.status !== 'skipped' && 'text-text')}>
                      {item.name}
                    </span>
                    {item.paidDate === null ? null : (
                      <span className="text-caption text-text-secondary">
                        {t('expenses:recurring.due.paidOn', {
                          date: formatFixedDate(item.paidDate),
                          method: t(`expenses:methods.${item.method}`),
                        })}
                      </span>
                    )}
                    <span className="font-medium tabular-nums text-text sm:hidden">
                      {money(shown)}
                    </span>
                    <span className="mt-1 sm:hidden">{status}</span>
                  </div>
                </TableCell>
                <TableCell className="max-md:hidden">
                  {t(`expenses:categories.${item.category}`)}
                </TableCell>
                <TableCell align="right" className="whitespace-nowrap max-sm:hidden" isNumeric>
                  <div className="flex flex-col items-end">
                    <span className="font-medium text-text">{money(shown)}</span>
                    {/* A meter bill differs from the template; show both when they do. */}
                    {item.paidAmount !== null && item.paidAmount !== item.amount ? (
                      <span className="text-caption text-text-secondary">
                        {t('expenses:recurring.due.expected', { amount: money(item.amount) })}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="max-sm:hidden">{status}</TableCell>
                <Can permission="expense:manage">
                  <TableCell align="right">
                    {item.status === 'paid' ? null : (
                      <div className="flex justify-end gap-1 max-sm:flex-col max-sm:items-end">
                        <Button
                          aria-label={`${t('expenses:recurring.pay.open')} — ${item.name}`}
                          onClick={() => setPaying(item)}
                          size="sm"
                          variant={isOpen ? 'primary' : 'secondary'}
                        >
                          {t('expenses:recurring.pay.open')}
                        </Button>
                        {isOpen ? (
                          <Button
                            aria-label={`${t('expenses:recurring.skip.open')} — ${item.name}`}
                            onClick={() => setSkipping(item)}
                            size="sm"
                            variant="ghost"
                          >
                            {t('expenses:recurring.skip.open')}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                </Can>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {paying === null ? null : (
        <PayDueDialog
          clinicId={clinicId}
          item={paying}
          month={due.month}
          onOpenChange={(open) => {
            if (!open) setPaying(null)
          }}
          open
        />
      )}

      {skipping === null ? null : (
        <SkipDueDialog
          clinicId={clinicId}
          item={skipping}
          month={due.month}
          monthLabel={monthLabel}
          onOpenChange={(open) => {
            if (!open) setSkipping(null)
          }}
          open
        />
      )}
    </ChartCard>
  )
}
