import { MoreVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCan } from '@/entities/session'
import type { Treatment } from '@/entities/treatment'
import { useCompleteTreatment } from '@/features/treatment-complete'
import { ApiError } from '@/shared/api/errors'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { Button, DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, toast } from '@/shared/ui'

export interface TreatmentRowActionsProps {
  clinicId: string
  treatment: Treatment
  /** True while the delete countdown runs: the row accepts no further actions. */
  isPending: boolean
  onEdit: (treatment: Treatment) => void
  onDelete: (treatment: Treatment) => void
  onPay: (treatment: Treatment) => void
}

const EMPTY = '—'

/**
 * The "⋮" menu of one row. Every item mirrors a server permission (UX only —
 * Django decides): the payment item also needs `money:view`, so a doctor the
 * owner hides money from never sees it.
 */
export function TreatmentRowActions({
  clinicId,
  treatment,
  isPending,
  onEdit,
  onDelete,
  onPay,
}: TreatmentRowActionsProps) {
  const { t } = useTranslation(['treatments', 'common'])
  const canManage = useCan('procedure:manage')
  const canVoid = useCan('procedure:void')
  const canTakePayment = useCan('payment:manage')
  const seesMoney = useCan('money:view')
  const { mutate: complete } = useCompleteTreatment(clinicId)

  const isVoided = treatment.status === 'voided'
  const showEdit = canManage && !isVoided
  const showComplete = canManage && treatment.status === 'inProgress'
  const showPay = canTakePayment && seesMoney && !isVoided
  const showDelete = canVoid && !isVoided

  if (!(showEdit || showComplete || showPay || showDelete)) return null

  const completeNow = () =>
    complete(treatment.id, {
      onSuccess: () => toast.success(t('treatments:complete.done')),
      onError: (error) =>
        toast.error(
          error instanceof ApiError && error.kind === 'network'
            ? t('common:error.network')
            : error instanceof ApiError && error.kind === 'forbidden'
              ? t('treatments:complete.forbidden')
              : t('treatments:complete.failed'),
        ),
    })

  return (
    <DropdownMenu
      trigger={
        <Button
          aria-label={t('treatments:table.actionsMenuLabel', {
            type: treatment.treatmentTypeName ?? EMPTY,
            date: formatFixedDate(treatment.startDate),
          })}
          disabled={isPending}
          size="sm"
          variant="ghost"
        >
          <MoreVertical aria-hidden="true" className="size-4" />
        </Button>
      }
    >
      {showEdit ? (
        <DropdownMenuItem onSelect={() => onEdit(treatment)}>
          {t('treatments:table.actionEdit')}
        </DropdownMenuItem>
      ) : null}
      {showComplete ? (
        <DropdownMenuItem onSelect={completeNow}>
          {t('treatments:table.actionComplete')}
        </DropdownMenuItem>
      ) : null}
      {showPay ? (
        <DropdownMenuItem onSelect={() => onPay(treatment)}>
          {t('treatments:table.actionPay')}
        </DropdownMenuItem>
      ) : null}
      {showDelete ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem isDestructive onSelect={() => onDelete(treatment)}>
            {t('treatments:table.actionDelete')}
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenu>
  )
}
