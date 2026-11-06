import { useTranslation } from 'react-i18next'
import type { Administrator } from '@/entities/administrator'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useDeleteAdministrator } from '../model/useDeleteAdministrator'

export interface DeleteAdministratorDialogProps {
  clinicId: string
  administrator: Pick<Administrator, 'id' | 'fullName'>
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * No forced delay, unlike the doctor delete: an admin account has no
 * appointment or treatment history hanging off it, only a login.
 */
export function DeleteAdministratorDialog({
  clinicId,
  administrator,
  open,
  onOpenChange,
}: DeleteAdministratorDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const { mutate, isPending, error, reset } = useDeleteAdministrator(clinicId)

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('admin:administrator.deleteFailed')

  return (
    <Dialog
      description={t('admin:administrator.deleteDescription', { name: administrator.fullName })}
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
            onClick={() => mutate(administrator.id, { onSuccess: () => onOpenChange(false) })}
            variant="danger"
          >
            {t('common:action.delete')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:administrator.deleteTitle')}
    >
      <div className="flex flex-col gap-3">
        <Alert title={t('admin:administrator.deleteWarning')} tone="warning" />
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
      </div>
    </Dialog>
  )
}
