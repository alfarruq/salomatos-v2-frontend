import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { type Expense, expenseKeys, expenseSchema, toExpense } from '@/entities/expense'
import { httpClient } from '@/shared/api/httpClient'

export interface VoidExpenseInput {
  id: string
  reason: string
}

/** Voiding, not `DELETE`: a money record never disappears without a trace. */
async function voidExpense({ id, reason }: VoidExpenseInput): Promise<Expense> {
  const raw = await httpClient<unknown>(`v1/expenses/${id}/void/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  return toExpense(v.parse(expenseSchema, raw))
}

/** ⛔ No optimistic update: money (§10). */
export function useVoidExpense(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: voidExpense,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.scope(clinicId) })
    },
  })
}
