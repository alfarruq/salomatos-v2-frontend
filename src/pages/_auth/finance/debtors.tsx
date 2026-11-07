import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import { useSession } from '@/entities/session'
import { DebtorTable } from '@/widgets/debtor-table'

/** Shareable view state (§3): a page number only — nothing here can identify anyone. */
const debtorsSearchSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

type DebtorsSearch = v.InferOutput<typeof debtorsSearchSchema>

export const Route = createFileRoute('/_auth/finance/debtors')({
  // A hand-edited URL falls back to the first page rather than an error.
  validateSearch: (search): DebtorsSearch => {
    const result = v.safeParse(debtorsSearchSchema, search)
    return result.success ? result.output : {}
  },
  component: DebtorsPage,
})

function DebtorsPage() {
  const { t } = useTranslation('finance')
  const { clinicId } = Route.useRouteContext()
  const session = useSession()
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-title3 text-text">{t('debtors.title')}</h2>
        <p className="text-callout text-text-secondary">{t('debtors.description')}</p>
      </div>
      <DebtorTable
        clinicId={clinicId}
        onPageChange={(page) =>
          void navigate({
            to: '/finance/debtors',
            search: (): DebtorsSearch => (page === 1 ? {} : { page }),
          })
        }
        page={search.page ?? 1}
        showBranch={session?.isAllBranches ?? false}
      />
    </div>
  )
}
