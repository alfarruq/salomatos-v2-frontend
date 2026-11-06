import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Doctor } from '@/entities/doctor'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useDeleteDoctor } from '../model/useDeleteDoctor'

export interface DeleteDoctorDialogProps {
  clinicId: string
  doctor: Pick<Doctor, 'id' | 'fullName'>
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CONFIRM_DELAY_SECONDS = 10

/**
 * A doctor carries appointment, treatment and patient history behind them,
 * so this follows the patient delete: an explicit warning and a forced delay
 * before the button can be pressed.
 */
export function DeleteDoctorDialog({
  clinicId,
  doctor,
  open,
  onOpenChange,
}: DeleteDoctorDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const { mutate, isPending, error, reset } = useDeleteDoctor(clinicId)
  const [secondsLeft, setSecondsLeft] = useState(CONFIRM_DELAY_SECONDS)

  // Restarts every time the dialog opens, so re-opening it cannot inherit an
  // already-elapsed delay.
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
        : t('admin:doctor.deleteFailed')

  const canConfirm = secondsLeft <= 0

  return (
    <Dialog
      description={t('admin:doctor.deleteDescription', { name: doctor.fullName })}
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
            onClick={() => mutate(doctor.id, { onSuccess: () => onOpenChange(false) })}
            variant="danger"
          >
            {canConfirm
              ? t('common:action.delete')
              : t('admin:doctor.deleteWait', { seconds: secondsLeft })}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:doctor.deleteTitle')}
    >
      <div className="flex flex-col gap-3">
        <Alert title={t('admin:doctor.deleteWarning')} tone="warning" />
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
      </div>
    </Dialog>
  )
}
