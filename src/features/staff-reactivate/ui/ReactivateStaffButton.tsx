import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, toast } from '@/shared/ui'
import { useReactivateStaff } from '../model/useReactivateStaff'

export interface ReactivateStaffButtonProps {
  clinicId: string
  staff: { id: string; fullName: string }
}

/** Not behind a confirmation: reactivating is undone by deactivating again. */
export function ReactivateStaffButton({ clinicId, staff }: ReactivateStaffButtonProps) {
  const { t } = useTranslation('admin')
  const { mutate, isPending } = useReactivateStaff(clinicId)

  return (
    <Button
      aria-label={`${t('staff.reactivate')} — ${staff.fullName}`}
      iconLeft={<RotateCcw aria-hidden="true" className="size-4" />}
      isLoading={isPending}
      onClick={() => mutate(staff.id, { onError: () => toast.error(t('staff.reactivateFailed')) })}
      size="sm"
      variant="secondary"
    >
      {t('staff.reactivate')}
    </Button>
  )
}
