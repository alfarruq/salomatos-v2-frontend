import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/shared/ui'
import type { ClinicFormInput } from '../model/formSchema'
import { WEEKDAYS } from '../model/types'

export interface WorkingHoursFieldsProps {
  form: UseFormReturn<ClinicFormInput>
  isDisabled?: boolean
}

/**
 * One row per weekday: an open/closed switch, and two native time inputs
 * shown only while the day is open.
 *
 * Native `<input type="time">` rather than a built control — a full picker
 * for one HH:mm value per row would be a lot of surface for something the
 * platform already does correctly and accessibly.
 */
export function WorkingHoursFields({ form, isDisabled = false }: WorkingHoursFieldsProps) {
  const { t } = useTranslation(['admin', 'common'])

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body text-text">{t('admin:clinic.hours')}</span>

      <div className="flex flex-col divide-y divide-border rounded-control border border-border">
        {WEEKDAYS.map((day) => (
          <div className="flex flex-wrap items-center gap-3 px-3 py-2" key={day}>
            <Controller
              control={form.control}
              name={`hours.${day}.isOpen`}
              render={({ field }) => (
                // Wide enough for the longest day name (Chorshanba) beside the switch.
                <div className="w-40">
                  <Switch
                    checked={field.value}
                    disabled={isDisabled}
                    label={t(`common:weekday.${day}`)}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />

            {form.watch(`hours.${day}.isOpen`) ? (
              <div className="flex min-w-0 items-center gap-2">
                <input
                  aria-label={t('admin:clinic.opensAt', { day: t(`common:weekday.${day}`) })}
                  className="min-w-0 rounded-control border border-border bg-surface px-2 py-1 text-body text-text"
                  disabled={isDisabled}
                  type="time"
                  {...form.register(`hours.${day}.open`)}
                />
                <span className="text-text-tertiary">–</span>
                <input
                  aria-label={t('admin:clinic.closesAt', { day: t(`common:weekday.${day}`) })}
                  className="min-w-0 rounded-control border border-border bg-surface px-2 py-1 text-body text-text"
                  disabled={isDisabled}
                  type="time"
                  {...form.register(`hours.${day}.close`)}
                />
              </div>
            ) : (
              <span className="text-body text-text-tertiary">{t('admin:clinic.closed')}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
