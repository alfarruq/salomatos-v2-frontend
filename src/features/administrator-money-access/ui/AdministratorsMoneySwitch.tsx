import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { clinicQueries } from '@/entities/clinic'
import { Switch } from '@/shared/ui'
import { useSetClinicAdminsMoney } from '../model/useAdminMoneyAccess'

export interface AdministratorsMoneySwitchProps {
  clinicId: string
}

/** The branch-wide switch: off hides money from every administrator, whatever their own switches say. */
export function AdministratorsMoneySwitch({ clinicId }: AdministratorsMoneySwitchProps) {
  const { t } = useTranslation('admin')
  const clinic = useQuery(clinicQueries.mine(clinicId))
  const mutation = useSetClinicAdminsMoney(clinicId)

  if (clinic.data == null) return null
  const checked = mutation.isPending ? mutation.variables : clinic.data.adminsSeeMoney

  return (
    <div className="flex flex-col gap-1 rounded-card border border-border p-3">
      <Switch
        checked={checked}
        disabled={mutation.isPending}
        label={t('administrator.money.allLabel')}
        onCheckedChange={(next) => mutation.mutate(next)}
      />
      <p className="text-caption text-text-secondary">
        {checked ? t('administrator.money.allOnHint') : t('administrator.money.allOffHint')}
      </p>
      {mutation.isError ? (
        <p className="text-caption text-danger" role="alert">
          {t('administrator.money.error')}
        </p>
      ) : null}
    </div>
  )
}
