import { valibotResolver } from '@hookform/resolvers/valibot'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  DoctorTypeFormFields,
  type DoctorTypeFormInput,
  doctorTypeFormFieldOf,
  doctorTypeFormSchema,
  emptyDoctorTypeForm,
} from '@/entities/doctor-type'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useCreateDoctorType } from '../model/useCreateDoctorType'

export interface CreateDoctorTypeDialogProps {
  clinicId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'create-doctor-type-form'

export function CreateDoctorTypeDialog({
  clinicId,
  open,
  onOpenChange,
}: CreateDoctorTypeDialogProps) {
  const { t } = useTranslation(['admin', 'common'])

  const form = useForm<DoctorTypeFormInput>({
    resolver: valibotResolver(doctorTypeFormSchema),
    mode: 'onBlur',
    defaultValues: emptyDoctorTypeForm,
  })

  const { mutate, isPending } = useCreateDoctorType(clinicId)

  const handleSubmit = form.handleSubmit((values) =>
    mutate(values, {
      onSuccess: () => {
        form.reset(emptyDoctorTypeForm)
        onOpenChange(false)
      },
      onError: (error) => {
        if (!(error instanceof ApiError)) {
          form.setError('root', { message: t('admin:doctorType.createFailed') })
          return
        }

        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const first = messages[0]
          if (first === undefined) continue
          form.setError(doctorTypeFormFieldOf(field), { message: first })
        }

        if (Object.keys(error.fieldErrors).length === 0) {
          form.setError('root', {
            message:
              error.kind === 'network'
                ? t('common:error.network')
                : t('admin:doctorType.createFailed'),
          })
        }
      },
    }),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      description={t('admin:doctorType.createDescription')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('admin:doctorType.create')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:doctorType.createTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <DoctorTypeFormFields form={form} isDisabled={isPending} />
      </form>
    </Dialog>
  )
}
