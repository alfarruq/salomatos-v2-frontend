import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import { useSession } from '@/entities/session'
import { DebtorTable } from '@/widgets/debtor-table'

/** Shareable view state (§3): a page number only — nothing here can identify anyone. */
const financeSearchSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

type FinanceSearch = v.InferOutput<typeof financeSearchSchema>

export const Route = createFileRoute('/_auth/finance')({
  // A hand-edited URL falls back to the first page rather than an error.
  validateSearch: (search): FinanceSearch => {
    const result = v.safeParse(financeSearchSchema, search)
    return result.success ? result.output : {}
  },
  component: FinancePage,
})

function FinancePage() {
  const { t } = useTranslation('finance')
  const { clinicId } = Route.useRouteContext()
  const session = useSession()
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title1 text-text">{t('title')}</h1>
        <p className="text-callout text-text-secondary">{t('debtors.description')}</p>
      </div>
      <h2 className="text-title3 text-text">{t('debtors.title')}</h2>
      <DebtorTable
        clinicId={clinicId}
        onPageChange={(page) =>
          void navigate({
            to: '/finance',
            search: (): FinanceSearch => (page === 1 ? {} : { page }),
          })
        }
        page={search.page ?? 1}
        showBranch={session?.isAllBranches ?? false}
      />
    </div>
  )
}
