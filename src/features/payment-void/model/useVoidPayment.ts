import { useMutation, useQueryClient } from '@tanstack/react-query'
import { balanceKeys, paymentKeys } from '@/entities/payment'
import { httpClient } from '@/shared/api/httpClient'

export interface VoidPaymentInput {
  paymentId: string
  reason: string
}

/** Money is append-only: a mistaken payment is voided with a reason, never deleted. */
async function voidPayment({ paymentId, reason }: VoidPaymentInput): Promise<void> {
  await httpClient<unknown>(`v1/payments/${paymentId}/void/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
}

/** ⛔ No optimistic update (§6.5): this changes what the patient owes. */
export function useVoidPayment(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: voidPayment,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.scope(clinicId) })
      void queryClient.invalidateQueries({ queryKey: balanceKeys.scope(clinicId) })
    },
  })
}
