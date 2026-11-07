import { useTranslation } from 'react-i18next'
import type { StatsBusySlot } from '@/entities/stats'
import { cn } from '@/shared/lib/cn'
import { weekdayLabel } from '@/shared/lib/report'

/** Sequential, one hue, light → dark (empty is the neutral sunken fill). */
const STEPS = ['bg-accent/20', 'bg-accent/40', 'bg-accent/60', 'bg-accent/80', 'bg-accent']

function stepOf(value: number, max: number): string {
  if (value === 0 || max === 0) return 'bg-sunken'
  const index = Math.min(STEPS.length - 1, Math.ceil((value / max) * STEPS.length) - 1)
  return STEPS[index] ?? 'bg-accent'
}

/** Weekday × hour: when the chairs are full and when they sit empty. */
export function BusyHoursHeatmap({ slots }: { slots: readonly StatsBusySlot[] }) {
  const { t, i18n } = useTranslation('statistics')
  const hours = [...new Set(slots.map((slot) => slot.hour))].sort((a, b) => a - b)
  const weekdays = [1, 2, 3, 4, 5, 6, 7]
  const max = Math.max(0, ...slots.map((slot) => slot.appointments))
  const valueAt = (weekday: number, hour: number) =>
    slots.find((slot) => slot.weekday === weekday && slot.hour === hour)?.appointments ?? 0

  return (
    <figure className="flex flex-col gap-3">
      {/* `relative`: the cells' `sr-only` counts would otherwise escape the scroll clip. */}
      <div className="relative overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <caption className="sr-only">{t('charts.busy.title')}</caption>
          <thead>
            <tr>
              <td />
              {hours.map((hour) => (
                <th
                  className="text-caption font-normal text-text-tertiary tabular-nums"
                  key={hour}
                  scope="col"
                >
                  {String(hour).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((weekday) => {
              const dayLabel = weekdayLabel(weekday, i18n.language)
              return (
                <tr key={weekday}>
                  <th
                    className="pr-2 text-left text-caption font-normal text-text-secondary"
                    scope="row"
                  >
                    {dayLabel}
                  </th>
                  {hours.map((hour) => {
                    const value = valueAt(weekday, hour)
                    return (
                      <td
                        className={cn('h-8 min-w-8 rounded', stepOf(value, max))}
                        key={hour}
                        title={`${dayLabel}, ${String(hour).padStart(2, '0')}:00 · ${value}`}
                      >
                        <span className="sr-only">{value}</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <figcaption className="flex items-center gap-2 text-caption text-text-tertiary">
        {t('charts.busy.less')}
        <span aria-hidden="true" className="flex gap-1">
          {STEPS.map((step) => (
            <span className={cn('size-3 rounded', step)} key={step} />
          ))}
        </span>
        {t('charts.busy.more')}
      </figcaption>
    </figure>
  )
}
