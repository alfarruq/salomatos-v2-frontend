import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import * as v from 'valibot'
import { useSession } from '@/entities/session'
import { REPORT_PERIODS } from '@/shared/lib/report'
import { FinanceOverview } from '@/widgets/finance-overview'

/** Shareable view state (§3): a period preset only — nothing here can identify anyone. */
const financeSearchSchema = v.object({
  period: v.optional(v.picklist(REPORT_PERIODS)),
})

type FinanceSearch = v.InferOutput<typeof financeSearchSchema>

export const Route = createFileRoute('/_auth/finance/')({
  // A hand-edited URL falls back to the default period rather than an error.
  validateSearch: (search): FinanceSearch => {
    const result = v.safeParse(financeSearchSchema, search)
    return result.success ? result.output : {}
  },
  beforeLoad: ({ context }) => {
    // A doctor sees debts but not the clinic's totals. UX only: the report endpoint refuses too.
    if (!context.session.permissions.has('report:view')) {
      throw redirect({ to: '/finance/debtors' })
    }
  },
  component: FinancePage,
})

function FinancePage() {
  const { clinicId } = Route.useRouteContext()
  const session = useSession()
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <FinanceOverview
      clinicId={clinicId}
      onPeriodChange={(period) =>
        void navigate({
          // The default stays out of the URL, so `/finance` is the canonical view.
          search: (): FinanceSearch => (period === 'month' ? {} : { period }),
          to: '/finance',
        })
      }
      period={search.period ?? 'month'}
      showBranch={session?.isAllBranches ?? false}
    />
  )
}
