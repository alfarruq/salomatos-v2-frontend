import { useTranslation } from 'react-i18next'
import type { StatsToothCount } from '@/entities/stats'
import { cn } from '@/shared/lib/cn'
import { DentalChart, type DentalChartLabels, type ToothStatusDef } from '@/shared/ui'

/** Same one-hue, light → dark scale as the busy-hours map, as fills on the arch. */
const LEVELS = [
  { id: 'level-1', fill: 'fill-accent/20', swatch: 'bg-accent/20' },
  { id: 'level-2', fill: 'fill-accent/45', swatch: 'bg-accent/45' },
  { id: 'level-3', fill: 'fill-accent/70', swatch: 'bg-accent/70' },
  { id: 'level-4', fill: 'fill-accent', swatch: 'bg-accent' },
]

const TOP_TEETH = 5

/** Which teeth the clinic treats most: the arch shaded by count, the leaders listed beside it. */
export function ToothHeatmap({ teeth }: { teeth: readonly StatsToothCount[] }) {
  const { t } = useTranslation(['statistics', 'treatments'])
  const max = Math.max(0, ...teeth.map((row) => row.count))

  const values: Record<string, string> = {}
  for (const row of teeth) {
    if (row.count === 0 || max === 0) continue
    const index = Math.min(LEVELS.length - 1, Math.ceil((row.count / max) * LEVELS.length) - 1)
    const level = LEVELS[index]
    if (level !== undefined) values[row.tooth] = level.id
  }

  const statuses: ToothStatusDef[] = LEVELS.map((level) => ({
    id: level.id,
    fillClassName: level.fill,
    strokeClassName: 'stroke-accent',
  }))

  const labels: DentalChartLabels = {
    incisor: t('treatments:composer.toothType.incisor'),
    canine: t('treatments:composer.toothType.canine'),
    premolar: t('treatments:composer.toothType.premolar'),
    molar: t('treatments:composer.toothType.molar'),
    upper: t('treatments:composer.toothType.upper'),
    lower: t('treatments:composer.toothType.lower'),
    tooth: t('treatments:composer.toothType.tooth'),
  }

  const leaders = [...teeth]
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_TEETH)

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
      <div className="flex w-full flex-col items-center gap-3 md:flex-1">
        <DentalChart className="w-full" labels={labels} statuses={statuses} values={values} />
        <div className="flex items-center gap-2 text-caption text-text-tertiary">
          {t('statistics:charts.busy.less')}
          <span aria-hidden="true" className="flex gap-1">
            {LEVELS.map((level) => (
              <span className={cn('size-3 rounded', level.swatch)} key={level.id} />
            ))}
          </span>
          {t('statistics:charts.busy.more')}
        </div>
      </div>

      <ol
        aria-label={t('statistics:charts.teeth.top')}
        className="flex w-full flex-col gap-2 md:w-48"
      >
        <li className="text-caption text-text-secondary">{t('statistics:charts.teeth.top')}</li>
        {leaders.map((row) => (
          <li className="flex items-baseline justify-between gap-3 text-callout" key={row.tooth}>
            <span className="text-text">
              {t('treatments:composer.toothType.tooth')} {row.tooth}
            </span>
            <span className="text-text-secondary tabular-nums">{row.count}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
