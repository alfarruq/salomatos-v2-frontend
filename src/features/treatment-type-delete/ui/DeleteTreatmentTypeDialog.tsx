import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TreatmentType } from '@/entities/treatment-type'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useDeleteTreatmentType } from '../model/useDeleteTreatmentType'

export interface DeleteTreatmentTypeDialogProps {
  clinicId: string
  service: TreatmentType
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CONFIRM_DELAY_SECONDS = 10

/**
 * Unlike a doctor type (`DeleteDoctorTypeDialog`), nothing on this client
 * confirms that deleting a service is side-effect free — a `Treatment` may
 * point at it, and whether that relation is `SET_NULL` or `CASCADE` on the
 * backend is not visible from here. The warning and the delay below are the
 * mitigation available at this layer; they do not stand in for confirming the
 * actual backend behaviour.
 */
export function DeleteTreatmentTypeDialog({
  clinicId,
  service,
  open,
  onOpenChange,
}: DeleteTreatmentTypeDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const { mutate, isPending, error, reset } = useDeleteTreatmentType(clinicId)
  const [secondsLeft, setSecondsLeft] = useState(CONFIRM_DELAY_SECONDS)

  // Restarts every time the dialog opens, so re-opening it for a different
  // service (or the same one, twice) cannot inherit an already-elapsed delay.
  useEffect(() => {
    if (!open) return

    setSecondsLeft(CONFIRM_DELAY_SECONDS)
    const timer = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [open])

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('admin:service.deleteFailed')

  const canConfirm = secondsLeft <= 0

  return (
    <Dialog
      description={t('admin:service.deleteDescription', { name: service.name })}
      footer={
        <>
          <Button
            disabled={isPending}
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
            variant="secondary"
          >
            {t('common:action.cancel')}
          </Button>
          <Button
            disabled={!canConfirm}
            isLoading={isPending}
            onClick={() => mutate(service.id, { onSuccess: () => onOpenChange(false) })}
            variant="danger"
          >
            {canConfirm
              ? t('common:action.delete')
              : t('admin:service.deleteWait', { seconds: secondsLeft })}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:service.deleteTitle')}
    >
      <div className="flex flex-col gap-3">
        <Alert title={t('admin:service.deleteWarning')} tone="warning" />
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
      </div>
    </Dialog>
  )
}
