import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  type DoctorType,
  DoctorTypeFormFields,
  type DoctorTypeFormInput,
  doctorTypeFormFieldOf,
  doctorTypeFormSchema,
  toDoctorTypeForm,
} from '@/entities/doctor-type'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useUpdateDoctorType } from '../model/useUpdateDoctorType'

export interface EditDoctorTypeDialogProps {
  clinicId: string
  doctorType: DoctorType
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'edit-doctor-type-form'

export function EditDoctorTypeDialog({
  clinicId,
  doctorType,
  open,
  onOpenChange,
}: EditDoctorTypeDialogProps) {
  const { t } = useTranslation(['admin', 'common'])

  const form = useForm<DoctorTypeFormInput>({
    resolver: valibotResolver(doctorTypeFormSchema),
    mode: 'onBlur',
    defaultValues: toDoctorTypeForm(doctorType),
  })

  const { reset } = form
  // `defaultValues` is read once, so without this the dialog would keep
  // showing whichever type it was first opened for — and rename that one.
  useEffect(() => {
    if (open) reset(toDoctorTypeForm(doctorType))
  }, [open, doctorType, reset])

  const { mutate, isPending } = useUpdateDoctorType(clinicId)

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      { doctorTypeId: doctorType.id, input: values },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('admin:doctorType.saveFailed') })
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
                  : t('admin:doctorType.saveFailed'),
            })
          }
        },
      },
    ),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
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
      title={t('admin:doctorType.editTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <DoctorTypeFormFields form={form} isDisabled={isPending} />
      </form>
    </Dialog>
  )
}
