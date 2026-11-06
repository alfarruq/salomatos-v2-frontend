import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  balanceKeys,
  type PaymentMethod,
  paymentKeys,
  paymentSchema,
  toPayment,
} from '@/entities/payment'
import { httpClient } from '@/shared/api/httpClient'

export interface RecordPaymentInput {
  patientId: string
  /** Plain digits, as `MoneyInput` emits them. */
  amount: string
  method: PaymentMethod
  notes: string
}

async function recordPayment(input: RecordPaymentInput) {
  const raw = await httpClient<unknown>('v1/payments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient: input.patientId,
      amount: input.amount,
      method: input.method,
      notes: input.notes,
    }),
  })
  return toPayment(v.parse(paymentSchema, raw))
}

/** ⛔ No optimistic update (§6.5): money is only shown once the server has it. */
export function useRecordPayment(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recordPayment,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.scope(clinicId) })
      void queryClient.invalidateQueries({ queryKey: balanceKeys.scope(clinicId) })
    },
  })
}
