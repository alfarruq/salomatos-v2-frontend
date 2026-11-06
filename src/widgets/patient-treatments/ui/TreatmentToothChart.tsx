import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Treatment } from '@/entities/treatment'
import { treatmentQueries } from '@/entities/treatment'
import {
  DentalChart,
  type DentalChartLabels,
  ErrorState,
  Skeleton,
  type ToothStatusDef,
} from '@/shared/ui'
import { summarizeTeeth } from '../model/toothSummary'
import { TreatmentDetailDialog } from './TreatmentDetailDialog'

export interface TreatmentToothChartProps {
  clinicId: string
  patientId: string
  onVoid: (treatment: Treatment) => void
}

interface HoverState {
  fdi: string
  x: number
  y: number
}

/**
 * The patient's teeth, marked where work has been recorded. Reads the same
 * query as the history table, so both tabs share one request and one cache
 * entry.
 */
export function TreatmentToothChart({ clinicId, patientId, onVoid }: TreatmentToothChartProps) {
  const { t } = useTranslation(['treatments', 'patients', 'common'])
  const query = useQuery(treatmentQueries.list(clinicId, patientId))
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverState | null>(null)
  const [detailTreatment, setDetailTreatment] = useState<Treatment | null>(null)

  const summary = useMemo(() => summarizeTeeth(query.data ?? []), [query.data])

  const labels: DentalChartLabels = {
    incisor: t('treatments:composer.toothType.incisor'),
    canine: t('treatments:composer.toothType.canine'),
    premolar: t('treatments:composer.toothType.premolar'),
    molar: t('treatments:composer.toothType.molar'),
    upper: t('treatments:composer.toothType.upper'),
    lower: t('treatments:composer.toothType.lower'),
    tooth: t('treatments:composer.toothType.tooth'),
  }

  // Theme tokens, not hex: both are redefined for dark mode in theme.css.
  const statuses: ToothStatusDef[] = [
    {
      id: 'done',
      fillClassName: 'fill-success/30',
      strokeClassName: 'stroke-success',
      label: t('treatments:chart.treated'),
    },
  ]

  function handleHover(fdi: string | null) {
    if (fdi === null || summary.values[fdi] === undefined) {
      setHover(null)
      return
    }
    // The chart reports only the tooth number; its position is read from the DOM.
    const element = containerRef.current?.querySelector(`[data-fdi="${fdi}"]`)
    if (element === null || element === undefined) return
    const rect = element.getBoundingClientRect()
    setHover({ fdi, x: rect.left + rect.width / 2, y: rect.top })
  }

  function handleClick(fdi: string) {
    const treatment = summary.latest[fdi]
    if (treatment === undefined) return
    setHover(null)
    setDetailTreatment(treatment)
  }

  if (query.isPending) return <Skeleton className="mx-auto aspect-[300/192] w-full max-w-md" />

  if (query.isError) {
    return (
      <ErrorState
        description={t('common:error.pageBody')}
        onRetry={() => void query.refetch()}
        retryLabel={t('common:action.retry')}
        title={t('common:error.pageTitle')}
      />
    )
  }

  const hoverNames = hover === null ? [] : (summary.names[hover.fdi] ?? [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title2 text-text">{t('patients:detail.toothChart')}</h2>
        <ul className="flex flex-wrap items-center gap-4 text-caption text-text-secondary">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-success" />
            {t('treatments:chart.treated')}
          </li>
        </ul>
      </div>

      <div className="flex justify-center" ref={containerRef}>
        <DentalChart
          className="w-full"
          labels={labels}
          onToothClick={(fdi) => handleClick(fdi)}
          onToothHover={handleHover}
          statuses={statuses}
          values={summary.values}
        />
      </div>

      {hover === null ? null : (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-control border border-border bg-elevated px-3 py-2 shadow-popover"
          role="tooltip"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <p className="text-callout font-medium text-text">
            {t('treatments:composer.toothType.tooth')} {hover.fdi}
          </p>
          {hoverNames.length === 0 ? null : (
            <p className="text-caption text-text-secondary">{hoverNames.join(', ')}</p>
          )}
        </div>
      )}

      {detailTreatment === null ? null : (
        <TreatmentDetailDialog
          onOpenChange={(open) => {
            if (!open) setDetailTreatment(null)
          }}
          onVoid={() => {
            onVoid(detailTreatment)
            setDetailTreatment(null)
          }}
          open
          treatment={detailTreatment}
        />
      )}
    </div>
  )
}
