import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Expense,
  type ExpensePayload,
  expenseKeys,
  expenseSchema,
  toExpense,
} from '@/entities/expense'
import { httpClient } from '@/shared/api/httpClient'

export interface CreateExpenseInput {
  payload: ExpensePayload
  /** Same for every retry of one entry, so a double submit can be told apart. */
  idempotencyKey: string
}

async function createExpense({ payload, idempotencyKey }: CreateExpenseInput): Promise<Expense> {
  const raw = await httpClient<unknown>('v1/expenses/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  })
  return toExpense(v.parse(expenseSchema, raw))
}

/** ⛔ No optimistic update: money, and the server assigns the id (§10). */
export function useCreateExpense(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createExpense,
    retry: false,
    onSuccess: () => {
      // The journal and the sums both change.
      void queryClient.invalidateQueries({ queryKey: expenseKeys.scope(clinicId) })
    },
  })
}
