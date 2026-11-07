import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { expenseQueries, type RecurringExpense } from '@/entities/expense'
import { Can } from '@/entities/session'
import { RecurringActiveSwitch, RecurringExpenseDialog } from '@/features/recurring-expense-save'
import { cn } from '@/shared/lib/cn'
import { formatSom } from '@/shared/lib/money'
import {
  Button,
  ChartCard,
  ErrorState,
  QueryBoundary,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/shared/ui'

/** `undefined`: closed. `null`: adding a new one. */
type Editing = RecurringExpense | null | undefined

export function RecurringTemplates({ clinicId }: { clinicId: string }) {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  const [editing, setEditing] = useState<Editing>(undefined)
  const query = useQuery(expenseQueries.recurring(clinicId))
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <ChartCard
      description={t('expenses:recurring.templates.description')}
      title={t('expenses:recurring.templates.title')}
    >
      <Can permission="expense:manage">
        <div>
          <Button
            iconLeft={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => setEditing(null)}
            size="sm"
            variant="secondary"
          >
            {t('expenses:recurring.create.open')}
          </Button>
        </div>
      </Can>
      <QueryBoundary
        empty={
          <p className="py-8 text-center text-callout text-text-secondary">
            {t('expenses:recurring.templates.empty')}
          </p>
        }
        error={({ retry }) => (
          <ErrorState
            description={t('expenses:error.description')}
            retryLabel={t('common:action.retry')}
            title={t('expenses:recurring.error')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={(templates) => templates.length === 0}
        loading={
          <Table density="compact">
            <TableSkeleton columns={4} rows={6} />
          </Table>
        }
        query={query}
      >
        {(templates) => (
          <Table density="compact">
            <TableHeader>
              <TableRow>
                <TableHead>{t('expenses:recurring.due.name')}</TableHead>
                <TableHead className="max-sm:hidden">
                  {t('expenses:recurring.templates.day')}
                </TableHead>
                <TableHead className="max-md:hidden">{t('expenses:journal.method')}</TableHead>
                <TableHead align="right" className="max-sm:hidden">
                  {t('expenses:journal.amount')}
                </TableHead>
                <Can permission="expense:manage">
                  <TableHead>
                    <span className="sr-only">{t('expenses:journal.actions')}</span>
                  </TableHead>
                </Can>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow
                  className={cn(!template.isActive && 'text-text-tertiary')}
                  key={template.id}
                >
                  <TableCell className="max-md:whitespace-normal">
                    <div className="flex flex-col">
                      <span className={cn(template.isActive && 'text-text')}>{template.name}</span>
                      <span className="text-caption">
                        {t(`expenses:categories.${template.category}`)}
                      </span>
                      <span className="text-caption tabular-nums sm:hidden">
                        {t('expenses:recurring.templates.everyMonth', { day: template.dayOfMonth })}
                        {' · '}
                        {money(template.amount)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap max-sm:hidden">
                    {t('expenses:recurring.templates.everyMonth', { day: template.dayOfMonth })}
                  </TableCell>
                  <TableCell className="max-md:hidden">
                    {t(`expenses:methods.${template.method}`)}
                  </TableCell>
                  <TableCell
                    align="right"
                    className={cn(
                      'whitespace-nowrap max-sm:hidden',
                      template.isActive && 'text-text',
                    )}
                    isNumeric
                  >
                    {money(template.amount)}
                  </TableCell>
                  <Can permission="expense:manage">
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <RecurringActiveSwitch clinicId={clinicId} template={template} />
                        <Button
                          aria-label={`${t('common:action.edit')} — ${template.name}`}
                          onClick={() => setEditing(template)}
                          size="sm"
                          variant="ghost"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </Can>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryBoundary>

      {editing === undefined ? null : (
        <RecurringExpenseDialog
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setEditing(undefined)
          }}
          open
          template={editing}
        />
      )}
    </ChartCard>
  )
}
