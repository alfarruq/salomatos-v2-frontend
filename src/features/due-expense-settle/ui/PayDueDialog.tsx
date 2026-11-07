import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  type CalendarMonth,
  type DueExpense,
  EXPENSE_METHODS,
  type PayDueFormInput,
  payDueFormFieldOf,
  payDueFormSchema,
  toPayDuePayload,
} from '@/entities/expense'
import { ApiError } from '@/shared/api/errors'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { clinicNow } from '@/shared/lib/datetime'
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
import { usePayDue } from '../model/useSettleDue'

export interface PayDueDialogProps {
  clinicId: string
  month: CalendarMonth
  item: DueExpense
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'pay-due-form'

function defaultsOf(item: DueExpense): PayDueFormInput {
  // Paid today unless said otherwise; a bill paid ahead of its day is still paid today.
  return { date: clinicNow().date, amount: String(item.amount), method: item.method, note: '' }
}

/**
 * Confirms one month of a bill. The amount is prefilled from the template but
 * stays editable: a meter bill is never the same twice, and the journal must
 * hold what really left the clinic.
 */
export function PayDueDialog({ clinicId, month, item, open, onOpenChange }: PayDueDialogProps) {
  const { t, i18n } = useTranslation(['expenses', 'common', 'validation'])
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const { mutate, isPending } = usePayDue(clinicId)

  const form = useForm<PayDueFormInput>({
    resolver: valibotResolver(payDueFormSchema),
    mode: 'onBlur',
    defaultValues: defaultsOf(item),
  })

  const { reset } = form
  useEffect(() => {
    if (open) reset(defaultsOf(item))
  }, [open, reset, item])

  const message = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      { recurringId: item.recurringId, payload: toPayDuePayload(month, values), idempotencyKey },
      {
        onSuccess: () => {
          setIdempotencyKey(crypto.randomUUID())
          toast.success(t('expenses:recurring.pay.success'))
          onOpenChange(false)
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('expenses:recurring.pay.failed') })
            return
          }
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(payDueFormFieldOf(field), { message: first })
          }
          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network'
                  ? t('common:error.network')
                  : t('expenses:recurring.pay.failed'),
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
      description={t('expenses:recurring.pay.description', {
        name: item.name,
        date: formatFixedDate(item.dueDate),
      })}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('expenses:recurring.pay.submit')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('expenses:recurring.pay.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
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

        {/* Free text is where a patient's name could slip in; the hint is the only guard here. */}
        <Field
          description={t('expenses:form.noteHint')}
          error={message(errors.note?.message)}
          label={t('expenses:form.note')}
        >
          <Textarea disabled={isPending} rows={2} {...form.register('note')} />
        </Field>
      </form>
    </Dialog>
  )
}
