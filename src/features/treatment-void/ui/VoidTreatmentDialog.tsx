import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Treatment } from '@/entities/treatment'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, Field, Textarea } from '@/shared/ui'
import { useVoidTreatment } from '../model/useVoidTreatment'

export interface VoidTreatmentDialogProps {
  clinicId: string
  treatment: Pick<Treatment, 'id' | 'treatmentTypeName' | 'toothNumber'>
  open: boolean
  onOpenChange: (open: boolean) => void
  onVoided: () => void
}

/**
 * Voids a recorded procedure. The row stays in the history, struck through,
 * with the reason beside it: a bill that silently loses lines is not one a
 * clinic can defend.
 */
export function VoidTreatmentDialog({
  clinicId,
  treatment,
  open,
  onOpenChange,
  onVoided,
}: VoidTreatmentDialogProps) {
  const { t } = useTranslation(['treatments', 'common'])
  const { mutate, isPending, error, reset } = useVoidTreatment(clinicId)
  const [reason, setReason] = useState('')

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : error instanceof ApiError && error.kind === 'forbidden'
          ? t('treatments:void.forbidden')
          : t('treatments:void.failed')

  return (
    <Dialog
      description={t('treatments:void.description', {
        type: treatment.treatmentTypeName ?? '—',
        tooth: treatment.toothNumber ?? '—',
      })}
      footer={
        <>
          <Button
            disabled={isPending}
            onClick={() => {
              reset()
              setReason('')
              onOpenChange(false)
            }}
            variant="secondary"
          >
            {t('common:action.cancel')}
          </Button>
          <Button
            disabled={reason.trim() === ''}
            isLoading={isPending}
            onClick={() =>
              mutate(
                { treatmentId: treatment.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    setReason('')
                    onVoided()
                  },
                },
              )
            }
            variant="primary"
          >
            {t('treatments:void.confirm')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('treatments:void.title')}
    >
      <div className="flex flex-col gap-3">
        <Field isRequired label={t('treatments:void.reason')}>
          <Textarea onChange={(event) => setReason(event.target.value)} value={reason} />
        </Field>
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
      </div>
    </Dialog>
  )
}
