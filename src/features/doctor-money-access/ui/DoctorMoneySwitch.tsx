import { useTranslation } from 'react-i18next'
import type { Doctor } from '@/entities/doctor'
import { Switch } from '@/shared/ui'
import { useSetDoctorMoney } from '../model/useMoneyAccess'

export interface DoctorMoneySwitchProps {
  clinicId: string
  doctor: Doctor
  /** The clinic-wide switch is off: this one has no effect until it is back on. */
  disabled?: boolean
}

/** One doctor's switch: on lets them see prices, payments and their own pay. */
export function DoctorMoneySwitch({ clinicId, doctor, disabled = false }: DoctorMoneySwitchProps) {
  const { t } = useTranslation('admin')
  const mutation = useSetDoctorMoney(clinicId)
  const checked = mutation.isPending ? mutation.variables.canSeeMoney : doctor.canSeeMoney

  return (
    <Switch
      aria-label={`${t('doctor.money.column')} — ${doctor.fullName}`}
      checked={checked && !disabled}
      disabled={disabled || mutation.isPending}
      label={checked && !disabled ? t('doctor.money.shown') : t('doctor.money.hidden')}
      onCheckedChange={(next) => mutation.mutate({ doctorId: doctor.id, canSeeMoney: next })}
    />
  )
}
