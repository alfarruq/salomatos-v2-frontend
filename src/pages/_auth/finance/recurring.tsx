import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import * as v from 'valibot'
import { CALENDAR_MONTH, currentMonth } from '@/shared/lib/calendarMonth'
import { FinanceRecurring } from '@/widgets/finance-recurring'

/** Shareable view state (§3): only the month. */
const recurringSearchSchema = v.object({
  month: v.optional(v.pipe(v.string(), v.regex(CALENDAR_MONTH))),
})

type RecurringSearch = v.InferOutput<typeof recurringSearchSchema>

export const Route = createFileRoute('/_auth/finance/recurring')({
  // A hand-edited URL falls back to the current month rather than an error.
  validateSearch: (search): RecurringSearch => {
    const result = v.safeParse(recurringSearchSchema, search)
    return result.success ? result.output : {}
  },
  beforeLoad: ({ context }) => {
    // UX only: the expense endpoints check `expense:view` themselves.
    if (!context.session.permissions.has('expense:view')) {
      throw redirect({ to: '/finance' })
    }
  },
  component: RecurringPage,
})

function RecurringPage() {
  const { clinicId } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const thisMonth = currentMonth()

  return (
    <FinanceRecurring
      clinicId={clinicId}
      month={search.month ?? thisMonth}
      onMonthChange={(month) =>
        void navigate({
          // The current month stays out of the URL, so `/finance/recurring` always means "now".
          search: (): RecurringSearch => (month === thisMonth ? {} : { month }),
          to: '/finance/recurring',
        })
      }
    />
  )
}
