import { useTranslation } from 'react-i18next'
import type { Administrator } from '@/entities/administrator'
import { Switch } from '@/shared/ui'
import { useSetAdminMoney } from '../model/useAdminMoneyAccess'

export interface AdministratorMoneySwitchesProps {
  clinicId: string
  administrator: Administrator
  /** The branch-wide switch is off: these have no effect until it is back on. */
  disabled?: boolean
}

/**
 * One administrator's two switches. The first lets them see money in the patient
 * and treatment sections at all; the second, once it is on, narrows that to debts.
 */
export function AdministratorMoneySwitches({
  clinicId,
  administrator,
  disabled = false,
}: AdministratorMoneySwitchesProps) {
  const { t } = useTranslation('admin')
  const mutation = useSetAdminMoney(clinicId)
  const pending = mutation.isPending ? mutation.variables : undefined
  const canSeeMoney = (pending?.canSeeMoney ?? administrator.canSeeMoney) && !disabled
  const debtsOnly = pending?.debtsOnly ?? administrator.debtsOnly

  return (
    <div className="flex flex-col gap-2">
      <Switch
        aria-label={`${t('administrator.money.seesLabel')} — ${administrator.fullName}`}
        checked={canSeeMoney}
        disabled={disabled || mutation.isPending}
        label={t('administrator.money.seesLabel')}
        onCheckedChange={(next) =>
          mutation.mutate({ administratorId: administrator.id, canSeeMoney: next })
        }
      />
      <Switch
        aria-label={`${t('administrator.money.debtsOnlyLabel')} — ${administrator.fullName}`}
        checked={canSeeMoney && debtsOnly}
        disabled={!canSeeMoney || mutation.isPending}
        label={t('administrator.money.debtsOnlyLabel')}
        onCheckedChange={(next) =>
          mutation.mutate({ administratorId: administrator.id, debtsOnly: next })
        }
      />
      {mutation.isError ? (
        <p className="text-caption text-danger" role="alert">
          {t('administrator.money.error')}
        </p>
      ) : null}
    </div>
  )
}
