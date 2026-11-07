import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import { useSession } from '@/entities/session'
import { STATS_PERIODS } from '@/entities/stats'
import { StatisticsOverview } from '@/widgets/statistics-overview'

/** Shareable view state (§3): a period preset only — nothing here can identify anyone. */
const statisticsSearchSchema = v.object({
  period: v.optional(v.picklist(STATS_PERIODS)),
})

type StatisticsSearch = v.InferOutput<typeof statisticsSearchSchema>

export const Route = createFileRoute('/_auth/statistics/')({
  // A hand-edited URL falls back to the default period rather than an error.
  validateSearch: (search): StatisticsSearch => {
    const result = v.safeParse(statisticsSearchSchema, search)
    return result.success ? result.output : {}
  },
  beforeLoad: ({ context }) => {
    // UX only: the report endpoint checks `report:view` itself.
    if (!context.session.permissions.has('report:view')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: StatisticsPage,
})

function StatisticsPage() {
  const { t } = useTranslation('statistics')
  const { clinicId } = Route.useRouteContext()
  const session = useSession()
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title1 text-text">{t('title')}</h1>

      <StatisticsOverview
        clinicId={clinicId}
        onPeriodChange={(period) =>
          void navigate({
            // The default stays out of the URL, so `/statistics` is the canonical view.
            search: (): StatisticsSearch => (period === 'month' ? {} : { period }),
            to: '/statistics',
          })
        }
        period={search.period ?? 'month'}
        showBranch={session?.isAllBranches ?? false}
      />
    </div>
  )
}
