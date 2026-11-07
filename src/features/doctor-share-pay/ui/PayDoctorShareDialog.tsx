import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  EXPENSE_METHODS,
  type ExpenseFormInput,
  emptyExpenseForm,
  expenseFormFieldOf,
  expenseFormSchema,
  type PayrollRow,
} from '@/entities/expense'
import { ApiError } from '@/shared/api/errors'
import type { CalendarMonth } from '@/shared/lib/calendarMonth'
import { clinicNow } from '@/shared/lib/datetime'
import { formatSom } from '@/shared/lib/money'
import {
  Alert,
  Button,
  DatePicker,
  Dialog,
  Field,
  MoneyInput,
  Select,
  Textarea,
  toast,
} from '@/shared/ui'
import { usePayDoctorShare } from '../model/usePayDoctorShare'

export interface PayDoctorShareDialogProps {
  clinicId: string
  row: PayrollRow
  /** The month of work being paid for, which is not always the month it is paid in. */
  month: CalendarMonth
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'pay-doctor-share-form'

function defaultsOf(row: PayrollRow): ExpenseFormInput {
  return {
    ...emptyExpenseForm(),
    category: 'doctor_share',
    doctorId: row.doctorId,
    method: 'cash',
    amount: row.balance > 0 ? String(Math.round(row.balance)) : '',
  }
}

/**
 * Prefilled with what is owed, and editable: a bonus, a deduction or a
 * rounded figure is the clinic's call, and the journal holds what was paid.
 */
export function PayDoctorShareDialog({
  clinicId,
  row,
  month,
  open,
  onOpenChange,
}: PayDoctorShareDialogProps) {
  const { t, i18n } = useTranslation(['expenses', 'common', 'validation'])
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const { mutate, isPending } = usePayDoctorShare(clinicId)

  const form = useForm<ExpenseFormInput>({
    resolver: valibotResolver(expenseFormSchema),
    mode: 'onBlur',
    defaultValues: defaultsOf(row),
  })

  const { reset } = form
  useEffect(() => {
    if (open) reset(defaultsOf(row))
  }, [open, reset, row])

  const message = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      {
        doctorId: row.doctorId,
        month,
        amount: Number(values.amount),
        method: values.method,
        spentOn: values.date,
        notes: values.note,
        idempotencyKey,
      },
      {
        onSuccess: () => {
          setIdempotencyKey(crypto.randomUUID())
          toast.success(t('expenses:payroll.pay.success'))
          onOpenChange(false)
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('expenses:payroll.pay.failed') })
            return
          }
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(field === 'month' ? 'root' : expenseFormFieldOf(field), {
              message: first,
            })
          }
          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network'
                  ? t('common:error.network')
                  : t('expenses:payroll.pay.failed'),
            })
          }
        },
      },
    ),
  )

  const errors = form.formState.errors
  const rootError = errors.root?.message ?? errors.doctorId?.message ?? errors.category?.message

  return (
    <Dialog
      description={t('expenses:payroll.pay.description', {
        name: row.doctorName,
        amount: formatSom(row.balance, i18n.language, t('common:currency.som')),
      })}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('expenses:payroll.pay.submit')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('expenses:payroll.pay.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={message(rootError) ?? rootError} tone="danger" /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={message(errors.date?.message)} isRequired label={t('expenses:form.date')}>
            <Controller
              control={form.control}
              name="date"
              render={({ field }) => (
                <DatePicker
                  disabled={isPending}
                  locale={i18n.language}
                  max={clinicNow().date}
                  nextMonthLabel={t('expenses:form.nextMonth')}
                  onChange={field.onChange}
                  placeholder={t('expenses:form.datePlaceholder')}
                  previousMonthLabel={t('expenses:form.previousMonth')}
                  value={field.value}
                />
              )}
            />
          </Field>

          <Field
            error={message(errors.amount?.message)}
            isRequired
            label={t('expenses:form.amount')}
          >
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <MoneyInput
                  disabled={isPending}
                  name={field.name}
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
          </Field>
        </div>

        <Field isRequired label={t('expenses:form.method')}>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <Select
                disabled={isPending}
                name={field.name}
                onValueChange={field.onChange}
                options={EXPENSE_METHODS.map((value) => ({
                  value,
                  label: t(`expenses:methods.${value}`),
                }))}
                value={field.value}
              />
            )}
          />
        </Field>

        <Field
          description={t('expenses:payroll.pay.noteHint')}
          error={message(errors.note?.message)}
          label={t('expenses:form.note')}
        >
          <Textarea disabled={isPending} rows={2} {...form.register('note')} />
        </Field>
      </form>
    </Dialog>
  )
}
