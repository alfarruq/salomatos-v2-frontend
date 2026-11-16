import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { clinicQueries } from '@/entities/clinic'
import { Switch } from '@/shared/ui'
import { useSetClinicMoney } from '../model/useMoneyAccess'

export interface DoctorsMoneySwitchProps {
  clinicId: string
}

/** The clinic-wide switch: off hides prices and payments from every doctor, whatever their own switch says. */
export function DoctorsMoneySwitch({ clinicId }: DoctorsMoneySwitchProps) {
  const { t } = useTranslation('admin')
  const clinic = useQuery(clinicQueries.mine(clinicId))
  const mutation = useSetClinicMoney(clinicId)

  if (clinic.data == null) return null
  const checked = mutation.isPending ? mutation.variables : clinic.data.doctorsSeeMoney

  return (
    <div className="flex flex-col gap-1 rounded-card border border-border p-3">
      <Switch
        checked={checked}
        disabled={mutation.isPending}
        label={t('doctor.money.allLabel')}
        onCheckedChange={(next) => mutation.mutate(next)}
      />
      <p className="text-caption text-text-secondary">
        {checked ? t('doctor.money.allOnHint') : t('doctor.money.allOffHint')}
      </p>
      {mutation.isError ? (
        <p className="text-caption text-danger" role="alert">
          {t('doctor.money.error')}
        </p>
      ) : null}
    </div>
  )
}
