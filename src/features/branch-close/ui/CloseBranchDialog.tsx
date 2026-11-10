import { useTranslation } from 'react-i18next'
import type { Branch } from '@/entities/branch'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useSetBranchOpen } from '../model/useSetBranchOpen'

export interface CloseBranchDialogProps {
  clinicId: string
  branch: Branch
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Closing is reversible, but it locks the branch's staff out, so it is confirmed first. */
export function CloseBranchDialog({
  clinicId,
  branch,
  open,
  onOpenChange,
}: CloseBranchDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const { mutate, isPending, error, reset } = useSetBranchOpen(clinicId)

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : error instanceof ApiError && error.kind === 'validation'
          ? t('admin:branch.lastBranch')
          : t('admin:branch.closeFailed')

  return (
    <Dialog
      description={t('admin:branch.closeDescription', { name: branch.name })}
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
            onClick={() =>
              mutate({ branchId: branch.id, open: false }, { onSuccess: () => onOpenChange(false) })
            }
            variant="danger"
          >
            {t('admin:branch.close')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:branch.closeTitle')}
    >
      {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
    </Dialog>
  )
}
