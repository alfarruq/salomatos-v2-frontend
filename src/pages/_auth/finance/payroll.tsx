import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import * as v from 'valibot'
import { CALENDAR_MONTH, currentMonth } from '@/shared/lib/calendarMonth'
import { FinancePayroll } from '@/widgets/finance-payroll'

/** Shareable view state (§3): only the month. */
const payrollSearchSchema = v.object({
  month: v.optional(v.pipe(v.string(), v.regex(CALENDAR_MONTH))),
})

type PayrollSearch = v.InferOutput<typeof payrollSearchSchema>

export const Route = createFileRoute('/_auth/finance/payroll')({
  // A hand-edited URL falls back to the current month rather than an error.
  validateSearch: (search): PayrollSearch => {
    const result = v.safeParse(payrollSearchSchema, search)
    return result.success ? result.output : {}
  },
  beforeLoad: ({ context }) => {
    // Pay is the owner's alone. UX only: the server refuses these endpoints too.
    if (!context.session.permissions.has('payroll:view')) {
      throw redirect({ to: '/finance' })
    }
  },
  component: PayrollPage,
})

function PayrollPage() {
  const { clinicId } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const thisMonth = currentMonth()

  return (
    <FinancePayroll
      clinicId={clinicId}
      month={search.month ?? thisMonth}
      onMonthChange={(month) =>
        void navigate({
          search: (): PayrollSearch => (month === thisMonth ? {} : { month }),
          to: '/finance/payroll',
        })
      }
    />
  )
}
