import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import { CALENDAR_MONTH, currentMonth } from '@/shared/lib/calendarMonth'
import { MyEarnings } from '@/widgets/my-earnings'

/** Shareable view state (§3): only the month. */
const earningsSearchSchema = v.object({
  month: v.optional(v.pipe(v.string(), v.regex(CALENDAR_MONTH))),
})

type EarningsSearch = v.InferOutput<typeof earningsSearchSchema>

export const Route = createFileRoute('/_auth/earnings')({
  // A hand-edited URL falls back to the current month rather than an error.
  validateSearch: (search): EarningsSearch => {
    const result = v.safeParse(earningsSearchSchema, search)
    return result.success ? result.output : {}
  },
  beforeLoad: ({ context }) => {
    // A doctor's own pay. UX only: the server answers 403 to anyone else.
    if (!context.session.permissions.has('payroll:view_own')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: EarningsPage,
})

function EarningsPage() {
  const { t } = useTranslation('earnings')
  const { clinicId } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const thisMonth = currentMonth()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-title1 text-text">{t('title')}</h1>
        <p className="text-callout text-text-secondary">{t('subtitle')}</p>
      </div>
      <MyEarnings
        clinicId={clinicId}
        month={search.month ?? thisMonth}
        onMonthChange={(month) =>
          void navigate({
            search: (): EarningsSearch => (month === thisMonth ? {} : { month }),
            to: '/earnings',
          })
        }
      />
    </div>
  )
}
