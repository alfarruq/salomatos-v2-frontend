import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  type Administrator,
  AdministratorFormFields,
  type AdministratorFormInput,
  administratorEditFormSchema,
  administratorFormFieldOf,
  toAdministratorForm,
} from '@/entities/administrator'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useUpdateAdministrator } from '../model/useUpdateAdministrator'

export interface EditAdministratorDialogProps {
  clinicId: string
  administrator: Administrator
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'edit-administrator-form'

/** Edit an admin's details, or set a new password when they forgot theirs. */
export function EditAdministratorDialog({
  clinicId,
  administrator,
  open,
  onOpenChange,
}: EditAdministratorDialogProps) {
  const { t } = useTranslation(['admin', 'common'])

  const form = useForm<AdministratorFormInput>({
    resolver: valibotResolver(administratorEditFormSchema),
    mode: 'onBlur',
    defaultValues: toAdministratorForm(administrator),
  })

  const { reset } = form
  // Refills on every opening, so the save never renames whoever it was first opened for.
  useEffect(() => {
    if (open) reset(toAdministratorForm(administrator))
  }, [open, administrator, reset])

  const { mutate, isPending } = useUpdateAdministrator(clinicId)

  const handleSubmit = form.handleSubmit((input) =>
    mutate(
      { administratorId: administrator.id, input },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (error instanceof ApiError) {
            for (const [field, messages] of Object.entries(error.fieldErrors)) {
              const first = messages[0]
              if (first !== undefined)
                form.setError(administratorFormFieldOf(field), { message: first })
            }
            if (Object.keys(error.fieldErrors).length > 0) return
          }
          form.setError('root', {
            message:
              error instanceof ApiError && error.kind === 'network'
                ? t('common:error.network')
                : t('admin:administrator.editFailed'),
          })
        },
      },
    ),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      description={t('admin:administrator.editDescription')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('common:action.save')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:administrator.editTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <AdministratorFormFields form={form} isDisabled={isPending} mode="edit" />
      </form>
    </Dialog>
  )
}
