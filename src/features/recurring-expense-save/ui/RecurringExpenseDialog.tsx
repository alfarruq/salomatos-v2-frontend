import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  emptyRecurringForm,
  type RecurringExpense,
  RecurringFormFields,
  type RecurringFormInput,
  recurringFormFieldOf,
  recurringFormSchema,
  toRecurringForm,
  toRecurringPayload,
} from '@/entities/expense'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, toast } from '@/shared/ui'
import { useCreateRecurring, useUpdateRecurring } from '../model/useSaveRecurring'

export interface RecurringExpenseDialogProps {
  clinicId: string
  /** `null` adds a new template. */
  template: RecurringExpense | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'recurring-expense-form'

/** Adds or edits a monthly bill. Saving one posts nothing: each month is confirmed by hand. */
export function RecurringExpenseDialog({
  clinicId,
  template,
  open,
  onOpenChange,
}: RecurringExpenseDialogProps) {
  const { t } = useTranslation(['expenses', 'common'])
  const create = useCreateRecurring(clinicId)
  const update = useUpdateRecurring(clinicId)
  const isPending = create.isPending || update.isPending
  const mode = template === null ? 'create' : 'edit'

  const form = useForm<RecurringFormInput>({
    resolver: valibotResolver(recurringFormSchema),
    mode: 'onBlur',
    defaultValues: template === null ? emptyRecurringForm : toRecurringForm(template),
  })

  const { reset } = form
  useEffect(() => {
    if (open) reset(template === null ? emptyRecurringForm : toRecurringForm(template))
  }, [open, reset, template])

  const handleError = (error: Error) => {
    const failed = t(`expenses:recurring.${mode}.failed`)
    if (!(error instanceof ApiError)) {
      form.setError('root', { message: failed })
      return
    }
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      const first = messages[0]
      if (first === undefined) continue
      form.setError(recurringFormFieldOf(field), { message: first })
    }
    if (Object.keys(error.fieldErrors).length === 0) {
      form.setError('root', {
        message: error.kind === 'network' ? t('common:error.network') : failed,
      })
    }
  }

  const handleSubmit = form.handleSubmit((values) => {
    const payload = toRecurringPayload(values)
    const onSuccess = () => {
      toast.success(t(`expenses:recurring.${mode}.success`))
      onOpenChange(false)
    }
    if (template === null) {
      create.mutate(payload, { onSuccess, onError: handleError })
    } else {
      update.mutate({ id: template.id, payload }, { onSuccess, onError: handleError })
    }
  })

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      description={t(`expenses:recurring.${mode}.description`)}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t(`expenses:recurring.${mode}.submit`)}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t(`expenses:recurring.${mode}.title`)}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <RecurringFormFields form={form} isDisabled={isPending} />
      </form>
    </Dialog>
  )
}
