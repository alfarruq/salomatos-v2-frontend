import { useTranslation } from 'react-i18next'
import type { Treatment } from '@/entities/treatment'
import { ApiError } from '@/shared/api/errors'
import { Button, toast } from '@/shared/ui'
import { useCompleteTreatment } from '../model/useCompleteTreatment'

export interface CompleteTreatmentButtonProps {
  clinicId: string
  treatmentId: string
  onCompleted?: (treatment: Treatment) => void
}

/** Marks multi-visit work as finished. The charge was owed from the start, so money is untouched. */
export function CompleteTreatmentButton({
  clinicId,
  treatmentId,
  onCompleted,
}: CompleteTreatmentButtonProps) {
  const { t } = useTranslation(['treatments', 'common'])
  const { mutate, isPending } = useCompleteTreatment(clinicId)

  return (
    <Button
      isLoading={isPending}
      onClick={() =>
        mutate(treatmentId, {
          onSuccess: (treatment) => {
            toast.success(t('treatments:complete.done'))
            onCompleted?.(treatment)
          },
          onError: (error) => {
            toast.error(
              error instanceof ApiError && error.kind === 'network'
                ? t('common:error.network')
                : error instanceof ApiError && error.kind === 'forbidden'
                  ? t('treatments:complete.forbidden')
                  : t('treatments:complete.failed'),
            )
          },
        })
      }
      variant="primary"
    >
      {t('treatments:complete.confirm')}
    </Button>
  )
}
