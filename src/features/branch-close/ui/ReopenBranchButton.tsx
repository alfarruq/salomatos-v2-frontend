import { useTranslation } from 'react-i18next'
import type { Branch } from '@/entities/branch'
import { Button } from '@/shared/ui'
import { useSetBranchOpen } from '../model/useSetBranchOpen'

export function ReopenBranchButton({ clinicId, branch }: { clinicId: string; branch: Branch }) {
  const { t } = useTranslation('admin')
  const { mutate, isPending } = useSetBranchOpen(clinicId)

  return (
    <Button
      isLoading={isPending}
      onClick={() => mutate({ branchId: branch.id, open: true })}
      size="sm"
      variant="secondary"
    >
      {t('branch.reopen')}
    </Button>
  )
}
