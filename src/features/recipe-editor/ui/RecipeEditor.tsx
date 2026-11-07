import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { doctorQueries } from '@/entities/doctor'
import { Can, useActsOnlyAs } from '@/entities/session'
import { requestVoiceDraft, type VoiceDraft, VoicePanel, voiceKeys } from '@/entities/voice-draft'
import { ApiError } from '@/shared/api/errors'
import {
  Alert,
  Button,
  Dialog,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  toast,
} from '@/shared/ui'
import { fromVoiceMedicine, isRowComplete, newMedicineRow, toRecipePayload } from '../model/payload'
import type { MedicineRow } from '../model/types'
import { useCreateRecipe } from '../model/useCreateRecipe'
import { MedicineRowFields } from './MedicineRowFields'

export interface RecipeEditorProps {
  clinicId: string
  patientId: string
  /** Shown read-only: the prescription is for the patient whose page opened it. */
  patientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Writes a prescription for the patient whose page opened it. There is no
 * date field on purpose: the server stamps `created_at`, and a hand-typed
 * date on a medical record is one more thing that can be wrong.
 */
export function RecipeEditor({
  clinicId,
  patientId,
  patientName,
  open,
  onOpenChange,
}: RecipeEditorProps) {
  const { t } = useTranslation(['recipes', 'common', 'voice'])
  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  const { mutate, isPending } = useCreateRecipe(clinicId)
  const queryClient = useQueryClient()
  // Every call is billed and writes nothing, so it is never retried.
  const voice = useMutation({
    mutationFn: requestVoiceDraft,
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: voiceKeys.status(clinicId) }),
  })
  const [voiceNote, setVoiceNote] = useState<string | null>(null)

  // A doctor writes prescriptions in their own name only.
  const onlyMe = useActsOnlyAs('patient:view_all')
  const [doctorId, setDoctorId] = useState(onlyMe ?? '')
  // One empty row to start with: there is no prescription without a medicine.
  const [rows, setRows] = useState<MedicineRow[]>(() => [newMedicineRow()])
  const [newRowId, setNewRowId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const namedRows = rows.filter((row) => row.name.trim() !== '')
  const incompleteRows = namedRows.filter((row) => !isRowComplete(row))
  const canSave = doctorId !== '' && namedRows.length > 0 && incompleteRows.length === 0

  /** Dictated medicines join the list; empty rows left from the start make way for them. */
  function applyVoiceDraft(draft: VoiceDraft) {
    const dictated = draft.medicines.filter((item) => item.medicine !== '').map(fromVoiceMedicine)
    if (dictated.length > 0) {
      setRows((current) => [...current.filter((row) => row.name.trim() !== ''), ...dictated])
    }
    if (draft.notes !== '' && notes.trim() === '') setNotes(draft.notes)
    setVoiceNote(dictated.length > 0 ? t('voice:result.filled') : t('voice:result.empty'))
  }

  function handleAddRow() {
    const row = newMedicineRow()
    setRows((current) => [...current, row])
    setNewRowId(row.rowId)
  }

  function handleSave() {
    mutate(toRecipePayload({ patientId, doctorId, notes, rows: namedRows }), {
      onSuccess: () => {
        toast.success(t('recipes:editor.saved'))
        onOpenChange(false)
      },
      // The dialog stays open with everything typed so far — nothing to redo.
      onError: (error) => {
        toast.error(
          error instanceof ApiError && error.kind === 'network'
            ? t('common:error.network')
            : t('recipes:editor.saveFailed'),
        )
      },
    })
  }

  const columns = [
    t('recipes:editor.nameLabel'),
    t('recipes:editor.doseLabel'),
    t('recipes:editor.frequencyLabel'),
    t('recipes:editor.durationLabel'),
    t('recipes:editor.mealLabel'),
  ]

  const body = doctorsQuery.isPending ? (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  ) : doctorsQuery.isError ? (
    <ErrorState description={t('common:error.pageBody')} title={t('common:error.pageTitle')} />
  ) : (
    <div className="flex flex-col gap-6">
      <Can permission="voice:use">
        <VoicePanel
          clinicId={clinicId}
          error={voice.error}
          hint={t('voice:hint.prescription')}
          isPending={voice.isPending}
          onSubmit={(text) =>
            voice.mutate({ form: 'prescription', text, patientId }, { onSuccess: applyVoiceDraft })
          }
        >
          {voiceNote === null ? null : <Alert title={voiceNote} tone="info" />}
        </VoicePanel>
      </Can>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('recipes:editor.patientLabel')}>
          <Input readOnly value={patientName} />
        </Field>
        <Field isRequired label={t('recipes:editor.doctorLabel')}>
          <Select
            onValueChange={setDoctorId}
            options={doctorsQuery.data
              .filter((doctor) => onlyMe === null || doctor.id === onlyMe)
              .map((doctor) => ({
                value: doctor.id,
                label:
                  doctor.doctorTypeName === null
                    ? doctor.fullName
                    : `${doctor.fullName} · ${doctor.doctorTypeName}`,
              }))}
            placeholder={t('recipes:editor.doctorPlaceholder')}
            {...(doctorId === '' ? {} : { value: doctorId })}
          />
        </Field>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-body font-medium text-text">{t('recipes:editor.medicinesTitle')}</h3>
          <span className="text-callout text-text-secondary">
            {t('recipes:list.medicineCount', { count: namedRows.length })}
          </span>
        </div>

        {/* Scrolls sideways on a phone rather than squeezing eight controls into 360px. */}
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-4xl text-left">
            <thead className="bg-sunken">
              <tr>
                <th className="w-10 px-3 py-2 text-center text-caption font-medium text-text-secondary uppercase">
                  #
                </th>
                {columns.map((column) => (
                  <th
                    className="px-2 py-2 text-caption font-medium text-text-secondary uppercase"
                    key={column}
                  >
                    {column}
                  </th>
                ))}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    className="px-3 py-6 text-center text-callout text-text-secondary"
                    colSpan={columns.length + 2}
                  >
                    {t('recipes:editor.noMedicines')}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <MedicineRowFields
                    isNew={row.rowId === newRowId}
                    key={row.rowId}
                    onChange={(next) =>
                      setRows((current) =>
                        current.map((item) => (item.rowId === row.rowId ? next : item)),
                      )
                    }
                    onRemove={() =>
                      setRows((current) => current.filter((item) => item.rowId !== row.rowId))
                    }
                    position={index + 1}
                    row={row}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-card border border-dashed border-border text-callout text-text-secondary transition-[border-color,color] duration-150 ease-out-apple hover:border-border-strong hover:text-text"
          onClick={handleAddRow}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('recipes:editor.addMedicine')}
        </button>

        {incompleteRows.length === 0 ? null : (
          <p className="text-caption text-danger" role="alert">
            {t('recipes:editor.incomplete')}
          </p>
        )}
      </section>

      <Field label={t('recipes:editor.notesLabel')}>
        <Textarea
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t('recipes:editor.notesPlaceholder')}
          rows={3}
          value={notes}
        />
      </Field>
    </div>
  )

  return (
    <Dialog
      className="sm:max-w-7xl"
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button disabled={!canSave} isLoading={isPending} onClick={handleSave} variant="primary">
            {t('recipes:editor.save')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('recipes:editor.title')}
    >
      {body}
    </Dialog>
  )
}
