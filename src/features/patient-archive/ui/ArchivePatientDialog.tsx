import { useTranslation } from 'react-i18next'
import type { Patient } from '@/entities/patient'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useArchivePatient } from '../model/useArchivePatient'

export interface ArchivePatientDialogProps {
  clinicId: string
  patient: Pick<Patient, 'id' | 'fullName'>
  open: boolean
  onOpenChange: (open: boolean) => void
  onArchived: () => void
}

/**
 * Hides a patient from the lists. Reversible (the server keeps a restore
 * action), so no countdown and no red button: red is for deletion (§13), and
 * nothing here is deleted.
 */
export function ArchivePatientDialog({
  clinicId,
  patient,
  open,
  onOpenChange,
  onArchived,
}: ArchivePatientDialogProps) {
  const { t } = useTranslation(['patients', 'common'])
  const { mutate, isPending, error, reset } = useArchivePatient(clinicId)

  const errorMessage =
    error === null
      ? null
      : !(error instanceof ApiError) || error.kind === 'network'
        ? t('common:error.network')
        : error.kind === 'forbidden'
          ? t('patients:archive.forbidden')
          : t('patients:archive.failed')

  return (
    <Dialog
      description={t('patients:archive.description', { name: patient.fullName })}
      footer={
        <>
          <Button
            disabled={isPending}
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
            variant="secondary"
          >
            {t('common:action.cancel')}
          </Button>
          <Button
            isLoading={isPending}
            onClick={() => mutate(patient.id, { onSuccess: onArchived })}
            variant="primary"
          >
            {t('patients:archive.confirm')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('patients:archive.title')}
    >
      {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
    </Dialog>
  )
}
