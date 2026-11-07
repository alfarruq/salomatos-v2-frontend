import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import * as v from 'valibot'
import { EXPENSE_CATEGORIES } from '@/entities/expense'
import { REPORT_PERIODS } from '@/shared/lib/report'
import { FinanceExpenses } from '@/widgets/finance-expenses'

/** Shareable view state (§3): a period, a category and a page — nothing that identifies anyone. */
const expensesSearchSchema = v.object({
  period: v.optional(v.picklist(REPORT_PERIODS)),
  category: v.optional(v.picklist(EXPENSE_CATEGORIES)),
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

type ExpensesSearch = v.InferOutput<typeof expensesSearchSchema>

export const Route = createFileRoute('/_auth/finance/expenses')({
  // A hand-edited URL falls back to the default view rather than an error.
  validateSearch: (search): ExpensesSearch => {
    const result = v.safeParse(expensesSearchSchema, search)
    return result.success ? result.output : {}
  },
  beforeLoad: ({ context }) => {
    // UX only: the expense endpoints check `expense:view` themselves.
    if (!context.session.permissions.has('expense:view')) {
      throw redirect({ to: '/finance' })
    }
  },
  component: ExpensesPage,
})

function ExpensesPage() {
  const { clinicId } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <FinanceExpenses
      clinicId={clinicId}
      onViewChange={(next) =>
        void navigate({
          // Defaults stay out of the URL, so `/finance/expenses` is the canonical view.
          search: (): ExpensesSearch => ({
            ...(next.period === 'month' ? {} : { period: next.period }),
            ...(next.category === null ? {} : { category: next.category }),
            ...(next.page === 1 ? {} : { page: next.page }),
          }),
          to: '/finance/expenses',
        })
      }
      view={{
        period: search.period ?? 'month',
        category: search.category ?? null,
        page: search.page ?? 1,
      }}
    />
  )
}
