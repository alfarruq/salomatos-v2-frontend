import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { doctorQueries } from '@/entities/doctor'
import {
  ExpenseFormFields,
  type ExpenseFormInput,
  emptyExpenseForm,
  expenseFormFieldOf,
  expenseFormSchema,
  toExpensePayload,
} from '@/entities/expense'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, toast } from '@/shared/ui'
import { useCreateExpense } from '../model/useCreateExpense'

export interface CreateExpenseDialogProps {
  clinicId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'create-expense-form'

export function CreateExpenseDialog({ clinicId, open, onOpenChange }: CreateExpenseDialogProps) {
  const { t } = useTranslation(['expenses', 'common'])

  const form = useForm<ExpenseFormInput>({
    resolver: valibotResolver(expenseFormSchema),
    mode: 'onBlur',
    defaultValues: emptyExpenseForm(),
  })

  // One key per entry, kept across retries of it and replaced once it is saved.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const { mutate, isPending } = useCreateExpense(clinicId)

  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  const doctorOptions = (doctorsQuery.data ?? []).map((doctor) => ({
    value: doctor.id,
    label: doctor.fullName,
  }))

  const handleSubmit = form.handleSubmit((values) => {
    mutate(
      { payload: toExpensePayload(values), idempotencyKey },
      {
        onSuccess: () => {
          form.reset(emptyExpenseForm())
          setIdempotencyKey(crypto.randomUUID())
          toast.success(t('expenses:create.success'))
          onOpenChange(false)
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('expenses:create.failed') })
            return
          }

          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(expenseFormFieldOf(field), { message: first })
          }

          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network' ? t('common:error.network') : t('expenses:create.failed'),
            })
          }
        },
      },
    )
  })

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      description={t('expenses:create.description')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('expenses:create.submit')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('expenses:create.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <ExpenseFormFields doctorOptions={doctorOptions} form={form} isDisabled={isPending} />
      </form>
    </Dialog>
  )
}
