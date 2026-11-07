import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Doctor } from '@/entities/doctor'
import { doctorQueries } from '@/entities/doctor'
import { Can, useActsOnlyAs } from '@/entities/session'
import type { TreatmentType } from '@/entities/treatment-type'
import { treatmentTypeQueries } from '@/entities/treatment-type'
import {
  requestVoiceDraft,
  type VoiceDraft,
  VoicePanel,
  type VoicePatientRef,
  voiceKeys,
} from '@/entities/voice-draft'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, ErrorState, Field, Select, Skeleton, Textarea } from '@/shared/ui'
import type { ComposerFields, TreatmentRow } from '../model/types'
import { useSaveTreatments } from '../model/useSaveTreatments'
import { PatientPicker, type PickedPatient } from './PatientPicker'
import { ToothPicker } from './ToothPicker'
import { TreatmentRowsTable } from './TreatmentRowsTable'
import { TreatmentTypeAdder } from './TreatmentTypeAdder'

export interface TreatmentComposerProps {
  clinicId: string
  /** Absent shows a patient picker instead — the journal's "add" button, where no patient is open yet. */
  patientId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preselected, e.g. the patient's primary doctor. */
  initialDoctorId?: string | null
}

let rowIdCounter = 0
function nextRowId(): string {
  rowIdCounter += 1
  return `row-${rowIdCounter}`
}

/**
 * Records the procedures done at a visit: pick teeth on the chart, a service
 * for each, adjust price or discount, save. Recorded lines are append-only, so
 * there is no edit mode — a mistake is voided from the history.
 *
 * Reads its own reference data (doctors, the price list) so every call site
 * only has to pass ids.
 */
export function TreatmentComposer({
  clinicId,
  patientId,
  open,
  onOpenChange,
  initialDoctorId,
}: TreatmentComposerProps) {
  const { t } = useTranslation(['treatments', 'common'])

  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  // A doctor records only their own work; the server refuses a colleague's name.
  const onlyMe = useActsOnlyAs('patient:view_all')
  const treatmentTypesQuery = useQuery(treatmentTypeQueries.list(clinicId))

  if (doctorsQuery.isPending || treatmentTypesQuery.isPending) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open} title={t('treatments:composer.title')}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Dialog>
    )
  }

  if (doctorsQuery.isError || treatmentTypesQuery.isError) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open} title={t('treatments:composer.title')}>
        <ErrorState description={t('common:error.pageBody')} title={t('common:error.pageTitle')} />
      </Dialog>
    )
  }

  return (
    <TreatmentComposerForm
      clinicId={clinicId}
      doctors={
        onlyMe === null
          ? doctorsQuery.data
          : doctorsQuery.data.filter((doctor) => doctor.id === onlyMe)
      }
      initialDoctorId={onlyMe ?? initialDoctorId ?? null}
      onOpenChange={onOpenChange}
      open={open}
      patientId={patientId}
      treatmentTypes={treatmentTypesQuery.data.filter((type) => type.isActive)}
    />
  )
}

/** Stands in for the chart / type list until there is a doctor to decide which. */
function ComposerHint({ children }: { children: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-card border border-dashed border-border p-6 text-center text-callout text-text-secondary">
      {children}
    </div>
  )
}

function TreatmentComposerForm({
  clinicId,
  patientId,
  open,
  onOpenChange,
  initialDoctorId,
  doctors,
  treatmentTypes,
}: {
  clinicId: string
  patientId: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDoctorId: string | null
  doctors: Doctor[]
  treatmentTypes: TreatmentType[]
}) {
  const { t } = useTranslation(['treatments', 'patients', 'common', 'voice'])
  const { mutate, isPending, error } = useSaveTreatments(clinicId)
  const queryClient = useQueryClient()
  // Every call is billed and writes nothing, so it is never retried.
  const voice = useMutation({
    mutationFn: requestVoiceDraft,
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: voiceKeys.status(clinicId) }),
  })
  const [voiceNotes, setVoiceNotes] = useState<string[]>([])
  const [voicePatients, setVoicePatients] = useState<VoicePatientRef[]>([])

  const [pickedPatient, setPickedPatient] = useState<PickedPatient | null>(null)
  const effectivePatientId = patientId ?? pickedPatient?.id ?? null

  const [rows, setRows] = useState<TreatmentRow[]>([])
  // Only a doctor still on the list: a stale id would leave the select blank but "set".
  const [doctorId, setDoctorId] = useState(() =>
    doctors.some((doctor) => doctor.id === initialDoctorId) ? (initialDoctorId ?? '') : '',
  )
  const [notes, setNotes] = useState('')

  /*
   * The doctor narrows the price list to their specialty plus the services
   * filed under none. A doctor with no specialty sees everything.
   */
  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId) ?? null
  const specialty = selectedDoctor?.doctorTypeId ?? null
  const specialtyTypes =
    specialty === null
      ? treatmentTypes
      : treatmentTypes.filter(
          (type) => type.doctorTypeId === null || type.doctorTypeId === specialty,
        )

  const canSave = rows.length > 0 && doctorId !== '' && effectivePatientId !== null

  const doctorOptions = doctors.map((doctor) => ({
    value: doctor.id,
    label:
      doctor.doctorTypeName === null
        ? doctor.fullName
        : `${doctor.fullName} · ${doctor.doctorTypeName}`,
  }))

  function handleDoctorChange(value: string) {
    const nextSpecialty = doctors.find((doctor) => doctor.id === value)?.doctorTypeId ?? null
    // Rows picked from the old specialty's services may not be the new doctor's work.
    if (nextSpecialty !== specialty) setRows([])
    setDoctorId(value)
  }

  function handleAddRow(toothNumber: number | null, type: TreatmentType) {
    setRows((current) => [
      ...current,
      {
        rowId: nextRowId(),
        toothNumber,
        treatmentTypeId: type.id,
        treatmentTypeName: type.name,
        unitPrice: String(type.price),
        discountPercent: '',
        inProgress: false,
      },
    ])
  }

  function handleRemoveTooth(toothNumber: number) {
    setRows((current) => current.filter((row) => row.toothNumber !== toothNumber))
  }

  function handleRowChange(rowId: string, changes: Partial<TreatmentRow>) {
    setRows((current) => current.map((row) => (row.rowId === rowId ? { ...row, ...changes } : row)))
  }

  function handleRemoveRow(rowId: string) {
    setRows((current) => current.filter((row) => row.rowId !== rowId))
  }

  /*
   * Adds what was dictated to what is already on the form, the same way a tap
   * on the chart would. Only services of the chosen doctor's price list are
   * taken; anything else is listed for the doctor to add by hand.
   */
  function applyVoiceDraft(draft: VoiceDraft) {
    const messages: string[] = []
    if (patientId === undefined && pickedPatient === null) {
      if (draft.patient !== null) {
        setPickedPatient({
          id: draft.patient.id,
          fullName: draft.patient.fullName,
          phoneNumber: null,
        })
        setVoicePatients([])
      } else if (draft.patientCandidates.length > 0) {
        setVoicePatients(draft.patientCandidates)
      } else if (draft.patientName !== '') {
        messages.push(t('voice:result.patientNotFound', { name: draft.patientName }))
      }
    }

    const unmatched: string[] = []
    for (const procedure of draft.procedures) {
      const type = specialtyTypes.find((item) => item.id === procedure.serviceId)
      if (type === undefined) unmatched.push(procedure.heard || procedure.serviceName)
      else handleAddRow(procedure.tooth, type)
    }
    if (draft.notes !== '' && notes.trim() === '') setNotes(draft.notes)

    const added = draft.procedures.length - unmatched.length
    messages.unshift(
      added > 0 || draft.patient !== null ? t('voice:result.filled') : t('voice:result.empty'),
    )
    if (unmatched.length > 0)
      messages.push(t('voice:result.unmatched', { items: unmatched.join(', ') }))
    setVoiceNotes(messages)
  }

  const errorMessage =
    error === null || error === undefined
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('treatments:composer.saveFailed')

  function handleSave() {
    if (effectivePatientId === null) return
    mutate(
      {
        patientId: effectivePatientId,
        rows,
        fields: { doctorId, notes } satisfies ComposerFields,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog
      className="sm:max-w-6xl"
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button disabled={!canSave} isLoading={isPending} onClick={handleSave} variant="primary">
            {t('treatments:composer.save')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('treatments:composer.title')}
    >
      <div className="flex flex-col gap-6">
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}

        <Can permission="voice:use">
          <VoicePanel
            clinicId={clinicId}
            disabledReason={selectedDoctor === null ? t('voice:result.chooseDoctorFirst') : null}
            error={voice.error}
            hint={t('voice:hint.procedure')}
            isPending={voice.isPending}
            onSubmit={(text) =>
              voice.mutate(
                { form: 'procedure', text, patientId: effectivePatientId },
                { onSuccess: applyVoiceDraft },
              )
            }
          >
            {voiceNotes.map((message) => (
              <Alert key={message} title={message} tone="info" />
            ))}
            {voicePatients.length > 0 && pickedPatient === null ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption text-text-secondary">
                  {t('voice:result.pickPatient')}
                </span>
                {voicePatients.map((candidate) => (
                  <Button
                    key={candidate.id}
                    onClick={() => {
                      setPickedPatient({
                        id: candidate.id,
                        fullName: candidate.fullName,
                        phoneNumber: null,
                      })
                      setVoicePatients([])
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    {candidate.fullName}
                  </Button>
                ))}
              </div>
            ) : null}
          </VoicePanel>
        </Can>

        {/* Fields first: the doctor has to be chosen before the right half means anything.
            Two columns only from `lg`: below that the chart needs the full width. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-4">
            {patientId === undefined ? (
              <PatientPicker
                clinicId={clinicId}
                isDisabled={isPending}
                onChange={setPickedPatient}
                value={pickedPatient}
              />
            ) : null}

            <Field isRequired label={t('treatments:composer.doctorLabel')}>
              <Select
                onValueChange={handleDoctorChange}
                options={doctorOptions}
                placeholder={t('treatments:composer.doctorPlaceholder')}
                {...(doctorId === '' ? {} : { value: doctorId })}
              />
            </Field>

            <Field label={t('treatments:composer.notesLabel')}>
              <Textarea onChange={(event) => setNotes(event.target.value)} rows={4} value={notes} />
            </Field>
          </div>

          {selectedDoctor === null ? (
            <ComposerHint>{t('treatments:composer.chooseDoctorFirst')}</ComposerHint>
          ) : specialtyTypes.length === 0 ? (
            <ComposerHint>{t('treatments:composer.noServices')}</ComposerHint>
          ) : (
            <div className="flex flex-col gap-4">
              <ToothPicker
                onAddTooth={handleAddRow}
                onRemoveTooth={handleRemoveTooth}
                rows={rows}
                treatmentTypes={specialtyTypes}
              />
              {/* Work that is not on one tooth: a cleaning, a consultation. */}
              <TreatmentTypeAdder
                onAdd={(type) => handleAddRow(null, type)}
                treatmentTypes={specialtyTypes}
              />
            </div>
          )}
        </div>

        <TreatmentRowsTable
          onRemoveRow={handleRemoveRow}
          onRowChange={handleRowChange}
          rows={rows}
          showToothColumn={rows.some((row) => row.toothNumber !== null)}
          treatmentTypes={specialtyTypes}
        />
      </div>
    </Dialog>
  )
}
