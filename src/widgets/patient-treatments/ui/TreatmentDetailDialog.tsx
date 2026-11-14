import { useTranslation } from 'react-i18next'
import { Can } from '@/entities/session'
import type { Treatment } from '@/entities/treatment'
import { TreatmentStatusBadge } from '@/entities/treatment'
import { CompleteTreatmentButton } from '@/features/treatment-complete'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { formatSom } from '@/shared/lib/money'
import { Button, Card, Dialog } from '@/shared/ui'

export interface TreatmentDetailDialogProps {
  clinicId: string
  treatment: Treatment
  open: boolean
  onOpenChange: (open: boolean) => void
  onVoid: () => void
  onCompleted: () => void
}

/** Shown when the server had nothing to send for a field. */
const EMPTY = '—'

/**
 * Read-only: a recorded procedure is never edited. "Batafsil" from the history
 * table and from a tooth on the chart.
 */
export function TreatmentDetailDialog({
  clinicId,
  treatment,
  open,
  onOpenChange,
  onVoid,
  onCompleted,
}: TreatmentDetailDialogProps) {
  const { t, i18n } = useTranslation(['treatments', 'common'])
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))

  return (
    <Dialog
      footer={
        treatment.status === 'voided' ? null : (
          <>
            <Can permission="procedure:void">
              <Button onClick={onVoid} variant="secondary">
                {t('treatments:void.confirm')}
              </Button>
            </Can>
            {treatment.status === 'inProgress' ? (
              <Can permission="procedure:manage">
                <CompleteTreatmentButton
                  clinicId={clinicId}
                  onCompleted={onCompleted}
                  treatmentId={treatment.id}
                />
              </Can>
            ) : null}
          </>
        )
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('treatments:detail.title')}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-callout font-medium text-text">
            {t('treatments:detail.toothLabel', { tooth: treatment.toothNumber ?? EMPTY })} —{' '}
            {treatment.treatmentTypeName ?? EMPTY}
          </h3>
          <TreatmentStatusBadge status={treatment.status} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <p className="text-caption text-text-tertiary">{t('treatments:detail.dateLabel')}</p>
            <p className="text-callout text-text">{formatFixedDate(treatment.startDate)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-caption text-text-tertiary">{t('treatments:detail.doctorLabel')}</p>
            <p className="text-callout text-text">{treatment.doctorName ?? EMPTY}</p>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <p className="text-caption text-text-tertiary">{t('treatments:detail.priceLabel')}</p>
            <p className="text-callout text-text tabular-nums">{money(treatment.unitPrice)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-caption text-text-tertiary">
              {t('treatments:detail.totalCostLabel')}
            </p>
            <p
              className={
                treatment.status === 'voided'
                  ? 'text-callout text-text-tertiary line-through tabular-nums'
                  : 'text-callout font-semibold text-text tabular-nums'
              }
            >
              {money(treatment.totalTreatmentCost)}
            </p>
          </Card>
        </div>

        {treatment.voidReason === null ? null : (
          <Card className="p-3">
            <p className="text-caption text-text-tertiary">
              {t('treatments:detail.voidReasonLabel')}
            </p>
            <p className="text-callout text-text">{treatment.voidReason}</p>
          </Card>
        )}

        {treatment.notes === null ? null : (
          <Card className="p-3">
            <p className="text-caption text-text-tertiary">{t('treatments:detail.notesLabel')}</p>
            <p className="text-callout text-text">{treatment.notes}</p>
          </Card>
        )}
      </div>
    </Dialog>
  )
}
