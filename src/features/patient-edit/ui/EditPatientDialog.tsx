import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { doctorQueries } from '@/entities/doctor'
import {
  type Patient,
  PatientFormFields,
  type PatientFormInput,
  patientFormFieldOf,
  patientFormSchema,
  toPatientForm,
} from '@/entities/patient'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useUpdatePatient } from '../model/useUpdatePatient'

export interface EditPatientDialogProps {
  clinicId: string
  patient: Pick<
    Patient,
    | 'id'
    | 'fullName'
    | 'phoneNumber'
    | 'birthDate'
    | 'address'
    | 'gender'
    | 'notes'
    | 'primaryDoctorId'
  >
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

const FORM_ID = 'edit-patient-form'

export function EditPatientDialog({
  clinicId,
  patient,
  open,
  onOpenChange,
  onSaved,
}: EditPatientDialogProps) {
  const { t } = useTranslation(['patients', 'common'])

  const form = useForm<PatientFormInput>({
    resolver: valibotResolver(patientFormSchema),
    mode: 'onBlur',
    defaultValues: toPatientForm(patient),
  })

  const { reset } = form
  /*
   * Refills the form when the dialog is opened for a different patient, or
   * after a refetch changed the record underneath.
   *
   * `defaultValues` alone is not enough: react-hook-form reads it once, so
   * without this the dialog would show the first patient it was ever opened
   * for — which in a patient record system means editing the wrong person.
   */
  useEffect(() => {
    if (open) reset(toPatientForm(patient))
  }, [open, patient, reset])

  const { mutate, isPending } = useUpdatePatient(clinicId)

  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  const doctorOptions = (doctorsQuery.data ?? []).map((doctor) => ({
    value: doctor.id,
    label: doctor.fullName,
  }))

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      {
        patientId: patient.id,
        input: values,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          onSaved?.()
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) return

          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(patientFormFieldOf(field), { message: first })
          }

          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network' ? t('common:error.network') : t('patients:edit.failed'),
            })
          }
        },
      },
    ),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      // Wider than the default: the doctor and the birth date share a row.
      className="max-w-xl"
      description={t('patients:edit.description')}
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
      title={t('patients:edit.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <PatientFormFields doctorOptions={doctorOptions} form={form} isDisabled={isPending} />
      </form>
    </Dialog>
  )
}
