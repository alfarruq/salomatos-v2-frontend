import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { type Expense, type VoidExpenseFormInput, voidExpenseFormSchema } from '@/entities/expense'
import { ApiError } from '@/shared/api/errors'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { formatSom } from '@/shared/lib/money'
import { Alert, Button, Dialog, Field, Textarea, toast } from '@/shared/ui'
import { useVoidExpense } from '../model/useVoidExpense'

export interface VoidExpenseDialogProps {
  clinicId: string
  expense: Expense
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'void-expense-form'

/**
 * Takes an entry out of every total while keeping it in the journal. The reason
 * is required: months later, "why is this crossed out?" must have an answer.
 */
export function VoidExpenseDialog({
  clinicId,
  expense,
  open,
  onOpenChange,
}: VoidExpenseDialogProps) {
  const { t, i18n } = useTranslation(['expenses', 'common', 'validation'])
  const { mutate, isPending, error, reset: resetMutation } = useVoidExpense(clinicId)

  const form = useForm<VoidExpenseFormInput>({
    resolver: valibotResolver(voidExpenseFormSchema),
    mode: 'onBlur',
    defaultValues: { reason: '' },
  })

  const { reset } = form
  useEffect(() => {
    if (open) reset({ reason: '' })
  }, [open, reset])

  const handleSubmit = form.handleSubmit(({ reason }) =>
    mutate(
      { id: expense.id, reason },
      {
        onSuccess: () => {
          toast.success(t('expenses:void.success'))
          onOpenChange(false)
        },
      },
    ),
  )

  const reasonError = form.formState.errors.reason?.message
  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('expenses:void.failed')

  return (
    <Dialog
      description={t('expenses:void.description', {
        amount: formatSom(expense.amount, i18n.language, t('common:currency.som')),
        category: t(`expenses:categories.${expense.category}`),
        date: formatFixedDate(expense.date),
      })}
      footer={
        <>
          <Button
            disabled={isPending}
            onClick={() => {
              resetMutation()
              onOpenChange(false)
            }}
            variant="secondary"
          >
            {t('expenses:void.keep')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="danger">
            {t('expenses:void.submit')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('expenses:void.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
        <Field
          description={t('expenses:void.reasonHint')}
          error={
            reasonError === undefined
              ? undefined
              : t(reasonError.replace('validation.', 'validation:'))
          }
          isRequired
          label={t('expenses:void.reason')}
        >
          <Textarea disabled={isPending} rows={2} {...form.register('reason')} />
        </Field>
      </form>
    </Dialog>
  )
}
