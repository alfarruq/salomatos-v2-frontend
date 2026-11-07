import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type CalendarMonth,
  type Expense,
  type ExpenseMethod,
  expenseKeys,
  expenseSchema,
  toExpense,
} from '@/entities/expense'
import { httpClient } from '@/shared/api/httpClient'

export interface PayDoctorShareInput {
  doctorId: string
  /** The month of work this payout settles. */
  month: CalendarMonth
  amount: number
  method: ExpenseMethod
  spentOn: string
  notes: string
  /** Same for every retry of one payout, so a double submit can be told apart. */
  idempotencyKey: string
}

/** Recorded by the server as a `doctor_share` expense: one record of money out. */
async function payDoctorShare(input: PayDoctorShareInput): Promise<Expense> {
  const raw = await httpClient<unknown>('v1/payroll/pay/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({
      doctor: input.doctorId,
      month: input.month,
      amount: input.amount,
      method: input.method,
      spent_on: input.spentOn,
      notes: input.notes,
    }),
  })
  return toExpense(v.parse(expenseSchema, raw))
}

/** ⛔ No optimistic update: money (§10). */
export function usePayDoctorShare(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: payDoctorShare,
    retry: false,
    onSuccess: () => {
      // The payroll, the journal and the sums all change.
      void queryClient.invalidateQueries({ queryKey: expenseKeys.scope(clinicId) })
    },
  })
}
