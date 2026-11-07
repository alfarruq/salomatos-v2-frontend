import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  AppointmentFormFields,
  type AppointmentFormInput,
  type AppointmentPatientResult,
  type AppointmentTreatmentTypeProps,
  appointmentFormFieldOf,
  appointmentFormSchema,
  emptyAppointmentForm,
} from '@/entities/appointment'
import { doctorQueries } from '@/entities/doctor'
import { defaultPatientFilters, patientQueries } from '@/entities/patient'
import { useActsOnlyAs } from '@/entities/session'
import { servicesForSpecialty, treatmentTypeQueries } from '@/entities/treatment-type'
import { ApiError } from '@/shared/api/errors'
import type { CalendarDate } from '@/shared/lib/calendarDate'
import { useDebounce } from '@/shared/lib/useDebounce'
import { Alert, Button, Dialog, toast } from '@/shared/ui'
import { isDoctorBusyError } from '../model/isDoctorBusyError'
import { useCreateAppointment } from '../model/useCreateAppointment'

export interface CreateAppointmentDialogProps {
  clinicId: string
  /** The day currently open in the calendar — where a new appointment starts. */
  defaultDate: CalendarDate
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Pre-links a patient — the "new appointment" action on that patient's own
   * page, as opposed to the calendar's, which starts with nothing linked.
   */
  initialPatient?: AppointmentPatientResult
}

const FORM_ID = 'create-appointment-form'
const PATIENT_SEARCH_DEBOUNCE_MS = 300
const RESULT_TOAST = { duration: 3000, richColors: true } as const

function initialFormValues(
  defaultDate: CalendarDate,
  initialPatient: AppointmentPatientResult | undefined,
): AppointmentFormInput {
  return {
    ...emptyAppointmentForm,
    date: defaultDate,
    ...(initialPatient === undefined
      ? {}
      : {
          patientId: initialPatient.id,
          fullName: initialPatient.fullName,
        }),
  }
}

export function CreateAppointmentDialog({
  clinicId,
  defaultDate,
  open,
  onOpenChange,
  initialPatient,
}: CreateAppointmentDialogProps) {
  const { t } = useTranslation(['appointments', 'common'])

  const form = useForm<AppointmentFormInput>({
    resolver: valibotResolver(appointmentFormSchema),
    mode: 'onBlur',
    defaultValues: initialFormValues(defaultDate, initialPatient),
  })

  /*
   * `defaultValues` is read once, on mount, and this dialog stays mounted —
   * so without this it reopened on whatever day it first saw: yesterday's
   * date on a page left open overnight, or the first day viewed in the
   * calendar. Each opening takes today (the caller's `defaultDate`) again,
   * unless the user already picked a date themselves.
   */
  useEffect(() => {
    if (open && !form.getFieldState('date').isDirty) {
      form.setValue('date', defaultDate)
    }
  }, [open, defaultDate, form])

  const { mutate, isPending } = useCreateAppointment(clinicId)

  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  // A doctor books only their own calendar; the front desk books anyone's.
  const onlyMe = useActsOnlyAs('appointment:view_all')
  const doctorOptions = (doctorsQuery.data ?? [])
    .filter((doctor) => onlyMe === null || doctor.id === onlyMe)
    .map((doctor) => ({ value: doctor.id, label: doctor.fullName }))

  useEffect(() => {
    if (open && onlyMe !== null && form.getValues('doctorId') === '') {
      form.setValue('doctorId', onlyMe)
    }
  }, [open, onlyMe, form])

  /*
   * Same rule as `features/treatment-composer`: the doctor's specialty narrows
   * the price list to its own services plus the ones filed under none.
   */
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
    // A service's length is the sensible default for the visit; staff can still change it.
    onPick: (serviceId) => {
      const picked = services.find((type) => type.id === serviceId)
      if (picked !== undefined) form.setValue('durationMinutes', String(picked.durationMinutes))
    },
  }

  /*
   * A search, not a full list — a clinic's patient roster is exactly the
   * unbounded case `usePatientSearch`/`PatientSearchInput` were built to keep
   * out of the URL (§3). This duplicates that hook's few lines rather than
   * importing `features/patient-search`, which §4 forbids between two
   * features of the same layer.
   */
  const [patientTerm, setPatientTerm] = useState('')
  const debouncedPatientTerm = useDebounce(patientTerm, PATIENT_SEARCH_DEBOUNCE_MS)
  const [linkedPatient, setLinkedPatient] = useState<AppointmentPatientResult | null>(
    initialPatient ?? null,
  )

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
    mutate(values, {
      onSuccess: () => {
        form.reset(initialFormValues(defaultDate, initialPatient))
        setLinkedPatient(initialPatient ?? null)
        setPatientTerm('')
        onOpenChange(false)
        toast.success(t('appointments:create.added'), RESULT_TOAST)
      },
      onError: (error) => {
        const failed = (message: string) => {
          form.setError('root', { message })
          toast.error(message, RESULT_TOAST)
        }

        if (isDoctorBusyError(error)) {
          failed(t('appointments:create.doctorBusy'))
          return
        }

        if (!(error instanceof ApiError)) {
          failed(t('appointments:create.failed'))
          return
        }

        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const first = messages[0]
          if (first === undefined) continue
          form.setError(appointmentFormFieldOf(field), { message: first })
        }

        if (Object.keys(error.fieldErrors).length === 0) {
          failed(
            error.kind === 'network' ? t('common:error.network') : t('appointments:create.failed'),
          )
        } else {
          toast.error(t('appointments:create.failed'), RESULT_TOAST)
        }
      },
    }),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      description={t('appointments:create.description')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('appointments:create.submit')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('appointments:create.title')}
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
          treatmentType={treatmentType}
        />
      </form>
    </Dialog>
  )
}
