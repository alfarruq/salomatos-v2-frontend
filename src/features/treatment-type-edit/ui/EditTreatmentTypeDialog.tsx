import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { doctorTypeQueries } from '@/entities/doctor-type'
import {
  type TreatmentType,
  TreatmentTypeFormFields,
  type TreatmentTypeFormInput,
  toTreatmentTypeForm,
  treatmentTypeFormFieldOf,
  treatmentTypeFormSchema,
} from '@/entities/treatment-type'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useUpdateTreatmentType } from '../model/useUpdateTreatmentType'

export interface EditTreatmentTypeDialogProps {
  clinicId: string
  service: TreatmentType
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'edit-treatment-type-form'

export function EditTreatmentTypeDialog({
  clinicId,
  service,
  open,
  onOpenChange,
}: EditTreatmentTypeDialogProps) {
  const { t } = useTranslation(['admin', 'common'])

  const form = useForm<TreatmentTypeFormInput>({
    resolver: valibotResolver(treatmentTypeFormSchema),
    mode: 'onBlur',
    defaultValues: toTreatmentTypeForm(service),
  })

  const { reset } = form
  // `defaultValues` is read once, so without this the dialog would keep showing
  // whichever service it was first opened for — and save over that one.
  useEffect(() => {
    if (open) reset(toTreatmentTypeForm(service))
  }, [open, service, reset])

  const { mutate, isPending } = useUpdateTreatmentType(clinicId)

  const doctorTypesQuery = useQuery(doctorTypeQueries.list(clinicId))
  const doctorTypeOptions = (doctorTypesQuery.data ?? []).map((doctorType) => ({
    value: String(doctorType.id),
    label: doctorType.name,
  }))

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      {
        treatmentTypeId: service.id,
        input: values,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('admin:service.saveFailed') })
            return
          }

          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(treatmentTypeFormFieldOf(field), { message: first })
          }

          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network'
                  ? t('common:error.network')
                  : t('admin:service.saveFailed'),
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
      title={t('admin:service.editTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <TreatmentTypeFormFields
          doctorTypeOptions={doctorTypeOptions}
          form={form}
          isDisabled={isPending}
        />
      </form>
    </Dialog>
  )
}
