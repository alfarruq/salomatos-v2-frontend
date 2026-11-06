import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, Field, Textarea } from '@/shared/ui'
import { useVoidPayment } from '../model/useVoidPayment'

export interface VoidPaymentDialogProps {
  clinicId: string
  paymentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The payment stays in the ledger, struck through, with the reason beside it. */
export function VoidPaymentDialog({
  clinicId,
  paymentId,
  open,
  onOpenChange,
}: VoidPaymentDialogProps) {
  const { t } = useTranslation(['finance', 'common'])
  const { mutate, isPending, error, reset } = useVoidPayment(clinicId)
  const [reason, setReason] = useState('')

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : error instanceof ApiError && error.kind === 'forbidden'
          ? t('finance:void.forbidden')
          : t('finance:void.failed')

  function close() {
    reset()
    setReason('')
    onOpenChange(false)
  }

  return (
    <Dialog
      description={t('finance:void.description')}
      footer={
        <>
          <Button disabled={isPending} onClick={close} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button
            disabled={reason.trim() === ''}
            isLoading={isPending}
            onClick={() => mutate({ paymentId, reason: reason.trim() }, { onSuccess: close })}
            variant="primary"
          >
            {t('finance:void.confirm')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('finance:void.title')}
    >
      <div className="flex flex-col gap-3">
        <Field isRequired label={t('finance:void.reason')}>
          <Textarea onChange={(event) => setReason(event.target.value)} value={reason} />
        </Field>
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
      </div>
    </Dialog>
  )
}
