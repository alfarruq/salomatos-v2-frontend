import { useTranslation } from 'react-i18next'
import type { DoctorType } from '@/entities/doctor-type'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useDeleteDoctorType } from '../model/useDeleteDoctorType'

export interface DeleteDoctorTypeDialogProps {
  clinicId: string
  doctorType: DoctorType
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A confirmation step, not a form — this is the one delete in the admin area
 * so far, and it earns one because it is also the one safe to offer: neither
 * `Doctor` nor `TreatmentType` loses anything when a type disappears
 * (`on_delete=SET_NULL` on both), unlike deleting a doctor or a service, which
 * would take appointment or treatment history down with them.
 */
export function DeleteDoctorTypeDialog({
  clinicId,
  doctorType,
  open,
  onOpenChange,
}: DeleteDoctorTypeDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const { mutate, isPending, error, reset } = useDeleteDoctorType(clinicId)

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('admin:doctorType.deleteFailed')

  return (
    <Dialog
      description={t('admin:doctorType.deleteDescription', { name: doctorType.name })}
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
            onClick={() => mutate(doctorType.id, { onSuccess: () => onOpenChange(false) })}
            variant="danger"
          >
            {t('common:action.delete')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:doctorType.deleteTitle')}
    >
      {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
    </Dialog>
  )
}
