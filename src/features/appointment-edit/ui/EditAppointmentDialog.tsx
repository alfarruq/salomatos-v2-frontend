import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  type Appointment,
  AppointmentFormFields,
  type AppointmentFormInput,
  type AppointmentPatientResult,
  type AppointmentTreatmentTypeProps,
  appointmentFormFieldOf,
  appointmentFormSchema,
  toAppointmentForm,
} from '@/entities/appointment'
import { doctorQueries } from '@/entities/doctor'
import { defaultPatientFilters, patientQueries } from '@/entities/patient'
import { servicesForSpecialty, treatmentTypeQueries } from '@/entities/treatment-type'
import { ApiError } from '@/shared/api/errors'
import { useDebounce } from '@/shared/lib/useDebounce'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useUpdateAppointment } from '../model/useUpdateAppointment'

export interface EditAppointmentDialogProps {
  clinicId: string
  appointment: Appointment
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'edit-appointment-form'
const PATIENT_SEARCH_DEBOUNCE_MS = 300

export function EditAppointmentDialog({
  clinicId,
  appointment,
  open,
  onOpenChange,
}: EditAppointmentDialogProps) {
  const { t } = useTranslation(['appointments', 'common'])

  const form = useForm<AppointmentFormInput>({
    resolver: valibotResolver(appointmentFormSchema),
    mode: 'onBlur',
    defaultValues: toAppointmentForm(appointment),
  })

  const { reset } = form
  // `defaultValues` is read once, so without this the dialog would keep
  // showing whichever appointment it was first opened for — and save over it.
  useEffect(() => {
    if (open) reset(toAppointmentForm(appointment))
  }, [open, appointment, reset])

  const { mutate, isPending } = useUpdateAppointment(clinicId)

  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  const doctorOptions = (doctorsQuery.data ?? []).map((doctor) => ({
    value: doctor.id,
    label: doctor.fullName,
  }))

  const treatmentTypesQuery = useQuery(treatmentTypeQueries.list(clinicId))
  const doctorId = useWatch({ control: form.control, name: 'doctorId' })
  const specialty =
    doctorsQuery.data?.find((doctor) => doctor.id === doctorId)?.doctorTypeId ?? null
  const services = servicesForSpecialty(treatmentTypesQuery.data ?? [], specialty)
  const treatmentType: AppointmentTreatmentTypeProps = {
    options: services.map((type) => ({ value: type.id, label: type.name })),
    emptyHint:
      doctorId === ''
        ? t('appointments:form.chooseDoctorFirst')
        : services.length === 0 && treatmentTypesQuery.isSuccess
          ? t('appointments:form.noServices')
          : null,
  }

  const [patientTerm, setPatientTerm] = useState('')
  const debouncedPatientTerm = useDebounce(patientTerm, PATIENT_SEARCH_DEBOUNCE_MS)
  const [linkedPatient, setLinkedPatient] = useState<AppointmentPatientResult | null>(
    appointment.patientId === null
      ? null
      : {
          id: appointment.patientId,
          fullName: appointment.fullName,
          phoneNumber: appointment.phoneNumber,
        },
  )

  useEffect(() => {
    setLinkedPatient(
      appointment.patientId === null
        ? null
        : {
            id: appointment.patientId,
            fullName: appointment.fullName,
            phoneNumber: appointment.phoneNumber,
          },
    )
    setPatientTerm('')
  }, [appointment])

  const patientsQuery = useQuery({
    ...patientQueries.list(clinicId, { ...defaultPatientFilters, search: debouncedPatientTerm }),
    enabled: debouncedPatientTerm !== '',
  })
  const patientResults: AppointmentPatientResult[] = (patientsQuery.data?.results ?? []).map(
    (patient) => ({ id: patient.id, fullName: patient.fullName, phoneNumber: patient.phoneNumber }),
  )

  const handleSelectPatient = (patient: AppointmentPatientResult) => {
    setLinkedPatient(patient)
    setPatientTerm('')
    form.setValue('patientId', patient.id, { shouldDirty: true })
    form.setValue('fullName', patient.fullName, { shouldDirty: true })
  }

  const handleUnlinkPatient = () => {
    setLinkedPatient(null)
    form.setValue('patientId', '', { shouldDirty: true })
  }

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      {
        appointmentId: appointment.id,
        input: values,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('appointments:edit.failed') })
            return
          }

          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(appointmentFormFieldOf(field), { message: first })
          }

          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network'
                  ? t('common:error.network')
                  : t('appointments:edit.failed'),
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
      title={t('appointments:edit.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <AppointmentFormFields
          doctorOptions={doctorOptions}
          form={form}
          isDisabled={isPending}
          patientPicker={{
            searchTerm: patientTerm,
            onSearchTermChange: setPatientTerm,
            results: patientResults,
            linkedPatientName: linkedPatient?.fullName ?? null,
            onSelect: handleSelectPatient,
            onUnlink: handleUnlinkPatient,
          }}
          showStatus
          treatmentType={treatmentType}
        />
      </form>
    </Dialog>
  )
}
