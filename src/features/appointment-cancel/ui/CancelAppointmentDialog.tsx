import { useTranslation } from 'react-i18next'
import type { Appointment } from '@/entities/appointment'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useCancelAppointment } from '../model/useCancelAppointment'

export interface CancelAppointmentDialogProps {
  clinicId: string
  appointment: Appointment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CancelAppointmentDialog({
  clinicId,
  appointment,
  open,
  onOpenChange,
}: CancelAppointmentDialogProps) {
  const { t } = useTranslation(['appointments', 'common'])
  const { mutate, isPending, error, reset } = useCancelAppointment(clinicId)

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('appointments:cancel.failed')

  return (
    <Dialog
      description={t('appointments:cancel.description', { name: appointment.fullName })}
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
            {t('appointments:cancel.keep')}
          </Button>
          <Button
            isLoading={isPending}
            onClick={() => mutate(appointment.id, { onSuccess: () => onOpenChange(false) })}
            variant="primary"
          >
            {t('appointments:cancel.confirm')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('appointments:cancel.title')}
    >
      {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
    </Dialog>
  )
}
