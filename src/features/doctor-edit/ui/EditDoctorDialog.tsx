import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  type Doctor,
  DoctorFormFields,
  type DoctorFormInput,
  doctorFormFieldOf,
  doctorFormSchema,
  toDoctorForm,
} from '@/entities/doctor'
import { doctorTypeQueries } from '@/entities/doctor-type'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useUpdateDoctor } from '../model/useUpdateDoctor'

export interface EditDoctorDialogProps {
  clinicId: string
  doctor: Doctor
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'edit-doctor-form'

export function EditDoctorDialog({ clinicId, doctor, open, onOpenChange }: EditDoctorDialogProps) {
  const { t } = useTranslation(['admin', 'common'])

  const form = useForm<DoctorFormInput>({
    resolver: valibotResolver(doctorFormSchema),
    mode: 'onBlur',
    defaultValues: toDoctorForm(doctor),
  })

  const { reset } = form
  /*
   * Refills when opened for a different doctor. `defaultValues` is read once,
   * so without this the dialog would show whoever it was first opened for —
   * and the save would rename the wrong person.
   */
  useEffect(() => {
    if (open) reset(toDoctorForm(doctor))
  }, [open, doctor, reset])

  const { mutate, isPending } = useUpdateDoctor(clinicId)

  const doctorTypesQuery = useQuery(doctorTypeQueries.list(clinicId))
  const doctorTypeOptions = (doctorTypesQuery.data ?? []).map((doctorType) => ({
    value: String(doctorType.id),
    label: doctorType.name,
  }))

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      {
        doctorId: doctor.id,
        input: values,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('admin:doctor.saveFailed') })
            return
          }

          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(doctorFormFieldOf(field), { message: first })
          }

          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network' ? t('common:error.network') : t('admin:doctor.saveFailed'),
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
      title={t('admin:doctor.editTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <DoctorFormFields
          doctorTypeOptions={doctorTypeOptions}
          form={form}
          isDisabled={isPending}
          mode="edit"
        />
      </form>
    </Dialog>
  )
}
