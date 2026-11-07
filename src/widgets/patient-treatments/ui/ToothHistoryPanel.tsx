import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Can } from '@/entities/session'
import { type Treatment, TreatmentStatusBadge } from '@/entities/treatment'
import { CompleteTreatmentButton } from '@/features/treatment-complete'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { cn } from '@/shared/lib/cn'
import { Button, TEETH } from '@/shared/ui'

export interface ToothHistoryPanelProps {
  clinicId: string
  /** FDI number of the selected tooth, or null when none is picked yet. */
  tooth: string | null
  /** Every line on that tooth, voided ones included, newest first. */
  treatments: readonly Treatment[]
  onOpen: (treatment: Treatment) => void
  onCreate?: () => void
}

/**
 * The whole story of one tooth beside the chart: the next doctor sees what a
 * colleague already did, and finishes work in progress without opening a dialog.
 */
export function ToothHistoryPanel({
  clinicId,
  tooth,
  treatments,
  onOpen,
  onCreate,
}: ToothHistoryPanelProps) {
  const { t } = useTranslation(['treatments', 'common'])
  const type = tooth === null ? undefined : TEETH.find((meta) => meta.fdi === tooth)?.type

  return (
    <section
      aria-live="polite"
      className="flex min-w-0 flex-col gap-3 rounded-card border border-border p-4"
    >
      {tooth === null ? (
        <p className="text-callout text-text-secondary">{t('treatments:chart.history.pick')}</p>
      ) : (
        <>
          <h3 className="text-body font-semibold text-text">
            {t('treatments:composer.toothType.tooth')} {tooth}
            {type === undefined ? null : (
              <span className="font-normal text-text-tertiary">
                {' '}
                · {t(`treatments:composer.toothType.${type}`)}
              </span>
            )}
          </h3>

          {treatments.length === 0 ? (
            <p className="text-callout text-text-secondary">
              {t('treatments:chart.history.empty')}
            </p>
          ) : (
            <ul className="flex flex-col">
              {treatments.map((treatment) => {
                const isVoided = treatment.status === 'voided'
                return (
                  <li
                    className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0"
                    key={treatment.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            'text-callout text-text',
                            isVoided && 'text-text-tertiary line-through',
                          )}
                        >
                          {treatment.treatmentTypeName ?? '—'}
                        </span>
                        <span className="text-caption text-text-tertiary tabular-nums">
                          {formatFixedDate(treatment.startDate)}
                          {treatment.doctorName === null ? null : ` · ${treatment.doctorName}`}
                        </span>
                      </div>
                      <TreatmentStatusBadge status={treatment.status} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => onOpen(treatment)} size="sm" variant="secondary">
                        {t('treatments:chart.history.details')}
                      </Button>
                      {treatment.status === 'inProgress' ? (
                        <Can permission="procedure:manage">
                          <CompleteTreatmentButton
                            clinicId={clinicId}
                            size="sm"
                            treatmentId={treatment.id}
                          />
                        </Can>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {onCreate === undefined ? null : (
        <Can permission="procedure:manage">
          <Button className="self-start" onClick={onCreate} size="sm" variant="ghost">
            <Plus aria-hidden="true" className="size-4" />
            {t('treatments:chart.history.add')}
          </Button>
        </Can>
      )}
    </section>
  )
}
