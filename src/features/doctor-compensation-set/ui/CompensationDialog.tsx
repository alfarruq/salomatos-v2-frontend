import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  COMPENSATION_BASES,
  type CompensationFormInput,
  CompensationTerms,
  compensationFormFieldOf,
  compensationFormSchema,
  expenseQueries,
  type PayrollRow,
  toCompensationForm,
  toCompensationPayload,
} from '@/entities/expense'
import { ApiError } from '@/shared/api/errors'
import {
  type CalendarMonth,
  currentMonth,
  monthLabel,
  shiftMonth,
} from '@/shared/lib/calendarMonth'
import {
  Alert,
  Button,
  Dialog,
  Field,
  Input,
  MoneyInput,
  Select,
  Skeleton,
  toast,
} from '@/shared/ui'
import { useSetCompensation } from '../model/useSetCompensation'

export interface CompensationDialogProps {
  clinicId: string
  row: PayrollRow
  /** The month on screen: the new terms start from it unless another one is picked. */
  month: CalendarMonth
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'compensation-form'

/**
 * Sets a doctor's pay terms from a month on. Earlier months keep the terms
 * they had, so changing a percent never rewrites what was already paid.
 */
export function CompensationDialog({
  clinicId,
  row,
  month,
  open,
  onOpenChange,
}: CompensationDialogProps) {
  const { t, i18n } = useTranslation(['expenses', 'common', 'validation'])
  const { mutate, isPending } = useSetCompensation(clinicId)
  const historyQuery = useQuery(expenseQueries.compensation(clinicId, row.doctorId))

  // A few months either side: terms are set for now, fixed for a month just
  // closed, or agreed ahead. The server accepts any month.
  const thisMonth = currentMonth()
  const months = [-2, -1, 0, 1, 2].map((delta) => shiftMonth(thisMonth, delta))
  if (!months.includes(month)) months.push(month)
  months.sort()

  const form = useForm<CompensationFormInput>({
    resolver: valibotResolver(compensationFormSchema),
    mode: 'onBlur',
    defaultValues: toCompensationForm(row.compensation, month),
  })

  const { reset } = form
  useEffect(() => {
    if (open) reset(toCompensationForm(row.compensation, month))
  }, [open, reset, row.compensation, month])

  const message = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      { doctorId: row.doctorId, payload: toCompensationPayload(values) },
      {
        onSuccess: () => {
          toast.success(t('expenses:payroll.terms.success'))
          onOpenChange(false)
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('expenses:payroll.terms.failed') })
            return
          }
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(compensationFormFieldOf(field), { message: first })
          }
          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network'
                  ? t('common:error.network')
                  : t('expenses:payroll.terms.failed'),
            })
          }
        },
      },
    ),
  )

  const errors = form.formState.errors
  const rootError = errors.root?.message

  return (
    <Dialog
      description={t('expenses:payroll.terms.description', { name: row.doctorName })}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('expenses:payroll.terms.submit')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('expenses:payroll.terms.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            description={t('expenses:payroll.terms.percentHint')}
            error={message(errors.percent?.message)}
            label={t('expenses:payroll.terms.percentLabel')}
          >
            <Input
              autoComplete="off"
              disabled={isPending}
              inputMode="decimal"
              placeholder="35"
              {...form.register('percent')}
            />
          </Field>

          <Field
            description={t('expenses:payroll.terms.fixedHint')}
            error={message(errors.fixed?.message)}
            label={t('expenses:payroll.terms.fixedLabel')}
          >
            <Controller
              control={form.control}
              name="fixed"
              render={({ field }) => (
                <MoneyInput
                  disabled={isPending}
                  name={field.name}
                  onChange={field.onChange}
                  placeholder="0"
                  value={field.value}
                />
              )}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field isRequired label={t('expenses:payroll.terms.base')}>
            <Controller
              control={form.control}
              name="base"
              render={({ field }) => (
                <Select
                  disabled={isPending}
                  name={field.name}
                  onValueChange={field.onChange}
                  options={COMPENSATION_BASES.map((value) => ({
                    value,
                    label: t(`expenses:payroll.terms.bases.${value}`),
                  }))}
                  value={field.value}
                />
              )}
            />
          </Field>

          <Field isRequired label={t('expenses:payroll.terms.effectiveFrom')}>
            <Controller
              control={form.control}
              name="effectiveFrom"
              render={({ field }) => (
                <Select
                  disabled={isPending}
                  name={field.name}
                  onValueChange={field.onChange}
                  options={months.map((value) => ({
                    value,
                    label: monthLabel(value, i18n.language),
                  }))}
                  value={field.value}
                />
              )}
            />
          </Field>
        </div>
      </form>

      <section className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-callout font-medium text-text">
          {t('expenses:payroll.terms.history')}
        </h3>
        {historyQuery.isPending ? (
          <Skeleton className="h-16" />
        ) : historyQuery.isError ? (
          <p className="text-caption text-text-secondary">{t('expenses:payroll.error')}</p>
        ) : historyQuery.data.length === 0 ? (
          <p className="text-caption text-text-secondary">
            {t('expenses:payroll.terms.noHistory')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {historyQuery.data.map((entry) => (
              <li className="flex flex-wrap gap-x-2 text-caption" key={entry.id}>
                <span className="text-text-secondary tabular-nums first-letter:uppercase">
                  {t('expenses:payroll.terms.since', {
                    month: monthLabel(entry.effectiveFrom, i18n.language),
                  })}
                </span>
                <span className="text-text">
                  <CompensationTerms compensation={entry} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Dialog>
  )
}
