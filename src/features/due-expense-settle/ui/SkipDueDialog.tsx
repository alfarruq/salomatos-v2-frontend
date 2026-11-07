import { useTranslation } from 'react-i18next'
import type { CalendarMonth, DueExpense } from '@/entities/expense'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, toast } from '@/shared/ui'
import { useSkipDue } from '../model/useSettleDue'

export interface SkipDueDialogProps {
  clinicId: string
  month: CalendarMonth
  monthLabel: string
  item: DueExpense
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** "Not this month" — a waived or moved bill. Nothing is posted; paying later still works. */
export function SkipDueDialog({
  clinicId,
  month,
  monthLabel,
  item,
  open,
  onOpenChange,
}: SkipDueDialogProps) {
  const { t } = useTranslation(['expenses', 'common'])
  const { mutate, isPending, error, reset } = useSkipDue(clinicId)

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('expenses:recurring.skip.failed')

  return (
    <Dialog
      description={t('expenses:recurring.skip.description', { name: item.name, month: monthLabel })}
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
              mutate(
                { recurringId: item.recurringId, month },
                {
                  onSuccess: () => {
                    toast.success(t('expenses:recurring.skip.success'))
                    onOpenChange(false)
                  },
                },
              )
            }
            variant="primary"
          >
            {t('expenses:recurring.skip.submit')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('expenses:recurring.skip.title')}
    >
      {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
    </Dialog>
  )
}
