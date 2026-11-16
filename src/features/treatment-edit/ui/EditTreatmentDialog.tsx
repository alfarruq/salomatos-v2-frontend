import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Treatment } from '@/entities/treatment'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, Field, Textarea, toast } from '@/shared/ui'
import { useUpdateTreatment } from '../model/useUpdateTreatment'

export interface EditTreatmentDialogProps {
  clinicId: string
  treatment: Pick<Treatment, 'id' | 'treatmentTypeName' | 'toothNumber' | 'notes'>
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Edits the note of a recorded procedure — the only field the server lets change. */
export function EditTreatmentDialog({
  clinicId,
  treatment,
  open,
  onOpenChange,
}: EditTreatmentDialogProps) {
  const { t } = useTranslation(['treatments', 'common'])
  const { mutate, isPending, error, reset } = useUpdateTreatment(clinicId)
  const [notes, setNotes] = useState(treatment.notes ?? '')

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : error instanceof ApiError && error.kind === 'forbidden'
          ? t('treatments:edit.forbidden')
          : t('treatments:edit.failed')

  function close() {
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      description={t('treatments:edit.description', {
        type: treatment.treatmentTypeName ?? '—',
        tooth: treatment.toothNumber ?? '—',
      })}
      footer={
        <>
          <Button disabled={isPending} onClick={close} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button
            isLoading={isPending}
            onClick={() =>
              mutate(
                { treatmentId: treatment.id, notes: notes.trim() },
                {
                  onSuccess: () => {
                    toast.success(t('treatments:edit.done'))
                    close()
                  },
                },
              )
            }
            variant="primary"
          >
            {t('common:action.save')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('treatments:edit.title')}
    >
      <div className="flex flex-col gap-3">
        <Field label={t('treatments:edit.notes')}>
          <Textarea onChange={(event) => setNotes(event.target.value)} value={notes} />
        </Field>
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
      </div>
    </Dialog>
  )
}
