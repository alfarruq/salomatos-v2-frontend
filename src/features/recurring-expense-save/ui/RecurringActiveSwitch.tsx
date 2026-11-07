import { useTranslation } from 'react-i18next'
import type { RecurringExpense } from '@/entities/expense'
import { Switch, toast } from '@/shared/ui'
import { useUpdateRecurring } from '../model/useSaveRecurring'

export interface RecurringActiveSwitchProps {
  clinicId: string
  template: RecurringExpense
}

/** Pauses a bill that stopped (a contract ended) without losing the months already paid. */
export function RecurringActiveSwitch({ clinicId, template }: RecurringActiveSwitchProps) {
  const { t } = useTranslation('expenses')
  const { mutate, isPending } = useUpdateRecurring(clinicId)

  return (
    <Switch
      checked={template.isActive}
      disabled={isPending}
      // Visible and short; the row already names the bill.
      label={t('recurring.templates.active')}
      onCheckedChange={(isActive) =>
        mutate(
          { id: template.id, payload: { is_active: isActive } },
          {
            onSuccess: () =>
              toast.success(
                t(isActive ? 'recurring.templates.resumed' : 'recurring.templates.paused'),
              ),
            onError: () => toast.error(t('recurring.edit.failed')),
          },
        )
      }
    />
  )
}
