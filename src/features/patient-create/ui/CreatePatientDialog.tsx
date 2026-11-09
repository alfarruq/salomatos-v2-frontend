import { valibotResolver } from '@hookform/resolvers/valibot'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Can, useActsOnlyAs } from '@/entities/session'
import { requestVoiceDraft, type VoiceDraft, VoicePanel, voiceKeys } from '@/entities/voice-draft'
import { ApiError } from '@/shared/api/errors'
import { toTypedDate } from '@/shared/lib/calendarDate'

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
  const { t } = useTranslation(['patients', 'common', 'voice'])
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

  // Reset rather than setValue: a previous walk-in's leftovers must not
  // survive into the next one's form.
  useEffect(() => {
    if (open && initialValues !== undefined) {
      form.reset({
        ...emptyPatientForm,
        ...initialValues,
      })
    }
  }, [open, initialValues, form])

  const { mutate, isPending } = useCreatePatient(clinicId)

  const queryClient = useQueryClient()
  // Every call is billed and writes nothing, so it is never retried.
  const voice = useMutation({
    mutationFn: requestVoiceDraft,
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: voiceKeys.status(clinicId) }),
  })
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const resetVoice = voice.reset

  useEffect(() => {
    if (open) {
      resetVoice()
      setVoiceNote(null)
    }
  }, [open, resetVoice])

  /** Fills only what was dictated; anything typed by hand for an unsaid field stays. */
  function applyVoiceDraft(draft: VoiceDraft) {
    const fields = draft.patientFields
    const options = { shouldDirty: true, shouldValidate: true } as const
    let filled = 0
    const text = (
      name: 'fullName' | 'phoneNumber' | 'birthDate' | 'address' | 'notes',
      value: string,
    ) => {
      if (value === '') return
      form.setValue(name, value, options)
      filled += 1
    }
    text('fullName', fields?.fullName ?? '')
    text('phoneNumber', fields?.phoneNumber ?? '')
    text('birthDate', fields?.birthDate ? toTypedDate(fields.birthDate) : '')
    text('address', fields?.address ?? '')
    text('notes', draft.notes)
    if (fields !== null && fields.gender !== '') {
      form.setValue('gender', fields.gender, options)
      filled += 1
    }
    setVoiceNote(filled > 0 ? t('voice:result.filled') : t('voice:result.empty'))
  }

  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  // A doctor registers patients to themselves; the server refuses anyone else.
  const onlyMe = useActsOnlyAs('patient:view_all')
  const doctorOptions = (doctorsQuery.data ?? [])
    .filter((doctor) => onlyMe === null || doctor.id === onlyMe)
    .map((doctor) => ({ value: doctor.id, label: doctor.fullName }))

  useEffect(() => {
    if (open && onlyMe !== null && form.getValues('doctorId') === '') {
      form.setValue('doctorId', onlyMe)
    }
  }, [open, onlyMe, form])

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
        <Can permission="voice:use">
          <VoicePanel
            clinicId={clinicId}
            error={voice.error}
            hint={t('voice:hint.patient')}
            isPending={voice.isPending}
            onSubmit={(text) =>
              voice.mutate({ form: 'patient', text }, { onSuccess: applyVoiceDraft })
            }
          >
            {voiceNote === null ? null : <Alert title={voiceNote} tone="info" />}
          </VoicePanel>
        </Can>
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
