import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  AdministratorFormFields,
  type AdministratorFormInput,
  administratorFormFieldOf,
  administratorFormSchema,
  emptyAdministratorForm,
} from '@/entities/administrator'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useCreateAdministrator } from '../model/useCreateAdministrator'

export interface CreateAdministratorDialogProps {
  clinicId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'create-administrator-form'

export function CreateAdministratorDialog({
  clinicId,
  open,
  onOpenChange,
}: CreateAdministratorDialogProps) {
  const { t } = useTranslation(['admin', 'common'])

  const form = useForm<AdministratorFormInput>({
    resolver: valibotResolver(administratorFormSchema),
    mode: 'onBlur',
    defaultValues: emptyAdministratorForm,
  })

  const { setValue } = form
  // The dialog stays mounted while closed, so a typed password would otherwise
  // sit in memory and reappear the next time it opens.
  useEffect(() => {
    if (!open) setValue('password', '')
  }, [open, setValue])

  const { mutate, isPending } = useCreateAdministrator(clinicId)

  const handleSubmit = form.handleSubmit((values) =>
    mutate(values, {
      onSuccess: () => {
        form.reset(emptyAdministratorForm)
        onOpenChange(false)
      },
      onError: (error) => {
        if (!(error instanceof ApiError)) {
          form.setError('root', { message: t('admin:administrator.createFailed') })
          return
        }

        // §10 — a taken login or phone belongs on its own input, not in a banner.
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const first = messages[0]
          if (first === undefined) continue
          form.setError(administratorFormFieldOf(field), { message: first })
        }

        if (Object.keys(error.fieldErrors).length === 0) {
          form.setError('root', {
            message:
              error.kind === 'network'
                ? t('common:error.network')
                : t('admin:administrator.createFailed'),
          })
        }
      },
    }),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      description={t('admin:administrator.createDescription')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('admin:administrator.create')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:administrator.createTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <AdministratorFormFields form={form} isDisabled={isPending} />
      </form>
    </Dialog>
  )
}
