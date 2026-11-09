import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Card } from '@/shared/ui'
import { isMedicalHistoryEmpty, type MedicalHistory } from '../model/medicalHistory'

export interface MedicalHistoryCardProps {
  history: MedicalHistory
  /** Pregnancy is not asked of male patients. */
  showPregnancy: boolean
  /** The edit button, from a feature: an entity shows, it does not act (§4). */
  action?: ReactNode
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-text-tertiary">{label}</dt>
      <dd className="text-callout whitespace-pre-line text-text">{value}</dd>
    </div>
  )
}

/**
 * The anamnesis a dentist must see before an injection or a prescription.
 * Allergies come first and stand out: missing one is the costly mistake.
 */
export function MedicalHistoryCard({ history, showPregnancy, action }: MedicalHistoryCardProps) {
  const { t } = useTranslation('patients')

  const pregnancy =
    history.isPregnant === null
      ? null
      : t(history.isPregnant ? 'medicalHistory.pregnancyYes' : 'medicalHistory.pregnancyNo')

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-headline text-text">{t('medicalHistory.title')}</h2>
        {action}
      </div>

      {isMedicalHistoryEmpty(history) ? (
        <p className="text-callout text-text-secondary">{t('medicalHistory.empty')}</p>
      ) : (
        <>
          {history.allergies === null ? (
            <p className="text-callout text-text-secondary">{t('medicalHistory.noAllergies')}</p>
          ) : (
            <Alert title={t('medicalHistory.allergies')} tone="warning">
              <span className="whitespace-pre-line">{history.allergies}</span>
            </Alert>
          )}
          <dl className="flex flex-col gap-3">
            {history.chronicConditions === null ? null : (
              <Fact
                label={t('medicalHistory.chronicConditions')}
                value={history.chronicConditions}
              />
            )}
            {history.currentMedications === null ? null : (
              <Fact
                label={t('medicalHistory.currentMedications')}
                value={history.currentMedications}
              />
            )}
            {showPregnancy && pregnancy !== null ? (
              <Fact label={t('medicalHistory.pregnancy')} value={pregnancy} />
            ) : null}
            {history.notes === null ? null : (
              <Fact label={t('medicalHistory.notes')} value={history.notes} />
            )}
          </dl>
        </>
      )}
    </Card>
  )
}
