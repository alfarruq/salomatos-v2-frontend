import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { doctorQueries } from '@/entities/doctor'
import {
  emptyPatientForm,
  PatientFormFields,
  type PatientFormInput,
  type PatientListItem,
  patientFormFieldOf,
  patientFormSchema,
} from '@/entities/patient'
import { ApiError } from '@/shared/api/errors'
import { toTypedDate } from '@/shared/lib/calendarDate'
import { clinicNow } from '@/shared/lib/datetime'
import { Alert, Button, Checkbox, Dialog } from '@/shared/ui'
import { useCreatePatient } from '../model/useCreatePatient'

export interface CreatePatientDialogProps {
  clinicId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (patient: PatientListItem, followUp: CreatePatientFollowUp) => void
  /**
   * Shows the "add a treatment" checkbox. The caller decides, because the
   * caller is the one that has to open the treatment dialog afterwards (§4:
   * features do not import one another) and knows whether the user may.
   */
  offerTreatment?: boolean
  /** Pre-filled on every opening, e.g. from a walk-in appointment being registered. */
  initialValues?: Partial<Pick<PatientFormInput, 'fullName' | 'phoneNumber'>>
}

/** What the user asked to do right after the patient is saved. */
export interface CreatePatientFollowUp {
  addTreatment: boolean
  /** The doctor picked in the form, so the next dialog can start on them. */
  doctorId: string | null
}

export function CreatePatientDialog({
  clinicId,
  open,
  onOpenChange,
  onCreated,
  offerTreatment = false,
  initialValues,
}: CreatePatientDialogProps) {
  const { t } = useTranslation(['patients', 'common'])
  // Off on every opening: a treatment is a deliberate step, not a default.
  const [addTreatment, setAddTreatment] = useState(false)
  const willAddTreatment = offerTreatment && addTreatment

  useEffect(() => {
    if (open) setAddTreatment(false)
  }, [open])

  const form = useForm<PatientFormInput>({
    resolver: valibotResolver(patientFormSchema),
    // onBlur, not onChange: validating every keystroke nags rather than helps.
    mode: 'onBlur',
    defaultValues: emptyPatientForm,
  })

  /*
   * The birth date opens on today, by the clinic's own decision (2026-10-09).
   * ⚠️ That means a skipped field saves today as the birth date rather than
   * nothing. Set on every opening, not via `defaultValues` — those are read
   * once and this dialog stays mounted — and only while the user has not
   * picked a date themselves.
   */
  useEffect(() => {
    if (open && !form.getFieldState('birthDate').isDirty) {
      form.setValue('birthDate', toTypedDate(clinicNow().date))
    }
  }, [open, form])

  // Reset rather than setValue: a previous walk-in's leftovers must not
  // survive into the next one's form.
  useEffect(() => {
    if (open && initialValues !== undefined) {
      form.reset({
        ...emptyPatientForm,
        ...initialValues,
        birthDate: toTypedDate(clinicNow().date),
      })
    }
  }, [open, initialValues, form])

  const { mutate, isPending } = useCreatePatient(clinicId)

  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  const doctorOptions = (doctorsQuery.data ?? []).map((doctor) => ({
    value: doctor.id,
    label: doctor.fullName,
  }))

  const handleSubmit = form.handleSubmit((values) =>
    mutate(values, {
      onSuccess: (patient) => {
        const doctorId = values.doctorId === '' ? null : values.doctorId
        form.reset(emptyPatientForm)
        onOpenChange(false)
        // The create response's id, never a list lookup: the new row may not
        // be in any list yet (server-side filters), but it exists.
        onCreated?.(patient, { addTreatment: willAddTreatment, doctorId })
      },
      onError: (error) => {
        if (!(error instanceof ApiError)) return

        /*
         * §10 — server validation goes back onto the fields. The most likely
         * rejection here is `unique_phone_per_clinic`, which arrives as
         * `{"phone_number": "unique"}` and has to land on the phone input
         * rather than in a generic banner.
         */
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const first = messages[0]
          if (first === undefined) continue
          form.setError(patientFormFieldOf(field), { message: first })
        }

        if (Object.keys(error.fieldErrors).length === 0) {
          form.setError('root', {
            message:
              error.kind === 'network' ? t('common:error.network') : t('patients:create.failed'),
          })
        }
      },
    }),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      // Wider than the default: the doctor and the birth date share a row.
      className="max-w-xl"
      description={t('patients:create.description')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {willAddTreatment ? t('patients:create.submitAndTreat') : t('patients:create.submit')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('patients:create.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <PatientFormFields doctorOptions={doctorOptions} form={form} isDisabled={isPending} />
        {offerTreatment ? (
          <Checkbox
            checked={addTreatment}
            disabled={isPending}
            label={t('patients:create.addTreatment')}
            onCheckedChange={(checked) => setAddTreatment(checked === true)}
          />
        ) : null}
      </form>
    </Dialog>
  )
}

/** The submit button lives in the dialog footer, outside the form element. */
const FORM_ID = 'create-patient-form'
