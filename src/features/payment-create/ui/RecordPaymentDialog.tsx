import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PAYMENT_METHODS, type PaymentMethod } from '@/entities/payment'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, Field, MoneyInput, RadioGroup, Textarea } from '@/shared/ui'
import { useRecordPayment } from '../model/useRecordPayment'

export interface RecordPaymentDialogProps {
  clinicId: string
  patientId: string
  /** Prefills the amount: the usual case is paying off the whole debt. */
  suggestedAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Enters money the clinic has already received at the desk. There is no
 * payment provider: this is a ledger line, so a mistake is voided, not edited.
 */
export function RecordPaymentDialog({
  clinicId,
  patientId,
  suggestedAmount,
  open,
  onOpenChange,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation(['finance', 'common'])
  const { mutate, isPending, error, reset } = useRecordPayment(clinicId)
  const [amount, setAmount] = useState(() =>
    suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : '',
  )
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')

  const amountError = error instanceof ApiError ? (error.fieldErrors.amount?.[0] ?? null) : null
  const errorMessage =
    error === null || amountError !== null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : error instanceof ApiError && error.kind === 'forbidden'
          ? t('finance:payment.forbidden')
          : t('finance:payment.failed')

  function close() {
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      footer={
        <>
          <Button disabled={isPending} onClick={close} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button
            disabled={Number(amount) <= 0}
            isLoading={isPending}
            onClick={() =>
              mutate({ patientId, amount, method, notes: notes.trim() }, { onSuccess: close })
            }
            variant="primary"
          >
            {t('finance:payment.save')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('finance:payment.title')}
    >
      <div className="flex flex-col gap-4">
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
        <Field
          isRequired
          label={t('finance:payment.amount')}
          {...(amountError === null ? {} : { error: amountError })}
        >
          <MoneyInput onChange={setAmount} value={amount} />
        </Field>
        <Field label={t('finance:payment.method')}>
          <RadioGroup
            onValueChange={(value) => {
              const picked = PAYMENT_METHODS.find((option) => option === value)
              if (picked !== undefined) setMethod(picked)
            }}
            options={PAYMENT_METHODS.map((value) => ({
              value,
              label: t(`finance:methods.${value}`),
            }))}
            value={method}
          />
        </Field>
        <Field label={t('finance:payment.notes')}>
          <Textarea onChange={(event) => setNotes(event.target.value)} rows={2} value={notes} />
        </Field>
      </div>
    </Dialog>
  )
}
