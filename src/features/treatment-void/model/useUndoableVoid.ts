import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/shared/ui'
import { useVoidTreatment } from './useVoidTreatment'

const COUNTDOWN_SECONDS = 5

/**
 * "O'chirish" from a list row: a visible countdown with an undo, then the
 * void goes to the server. Still a void, never a delete — the row stays in
 * the history, struck through (money is append-only).
 */
export function useUndoableVoid(
  clinicId: string,
  onPendingChange: (id: string, on: boolean) => void,
) {
  const { t } = useTranslation(['treatments', 'common'])
  const { mutate } = useVoidTreatment(clinicId)
  const timers = useRef(new Map<string, ReturnType<typeof setInterval>>())

  return useCallback(
    (treatmentId: string) => {
      if (timers.current.has(treatmentId)) return
      const toastId = `void:${treatmentId}`
      let left = COUNTDOWN_SECONDS
      onPendingChange(treatmentId, true)

      const stop = () => {
        const timer = timers.current.get(treatmentId)
        if (timer !== undefined) clearInterval(timer)
        timers.current.delete(treatmentId)
      }
      const show = () =>
        toast(t('treatments:void.countdown', { seconds: left }), {
          id: toastId,
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: t('common:action.undo'),
            onClick: () => {
              stop()
              onPendingChange(treatmentId, false)
              toast.dismiss(toastId)
            },
          },
        })

      show()
      timers.current.set(
        treatmentId,
        setInterval(() => {
          left -= 1
          if (left > 0) {
            show()
            return
          }
          stop()
          toast.dismiss(toastId)
          mutate(
            { treatmentId, reason: t('treatments:void.quickReason') },
            {
              onSuccess: () => toast.success(t('treatments:void.done')),
              onError: () => toast.error(t('treatments:void.failed')),
              onSettled: () => onPendingChange(treatmentId, false),
            },
          )
        }, 1000),
      )
    },
    [mutate, onPendingChange, t],
  )
}
