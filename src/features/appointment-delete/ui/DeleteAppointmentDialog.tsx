import { useTranslation } from 'react-i18next'
import type { Appointment } from '@/entities/appointment'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useDeleteAppointment } from '../model/useDeleteAppointment'

export interface DeleteAppointmentDialogProps {
  clinicId: string
  appointment: Appointment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteAppointmentDialog({
  clinicId,
  appointment,
  open,
  onOpenChange,
}: DeleteAppointmentDialogProps) {
  const { t } = useTranslation(['appointments', 'common'])
  const { mutate, isPending, error, reset } = useDeleteAppointment(clinicId)

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('appointments:delete.failed')

  return (
    <Dialog
      description={t('appointments:delete.description', { name: appointment.fullName })}
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
            isLoading={isPending}
            onClick={() => mutate(appointment.id, { onSuccess: () => onOpenChange(false) })}
            variant="danger"
          >
            {t('common:action.delete')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('appointments:delete.title')}
    >
      {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
    </Dialog>
  )
}
