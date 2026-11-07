import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import { useSession } from '@/entities/session'
import { STATS_PERIODS, type StatsPeriod } from '@/entities/stats'
import { StatisticsOverview } from '@/widgets/statistics-overview'

/** Shareable view state (§3): a period preset and a staff UUID — nothing that identifies a patient. */
const statisticsSearchSchema = v.object({
  period: v.optional(v.picklist(STATS_PERIODS)),
  doctor: v.optional(v.pipe(v.string(), v.uuid())),
})

type StatisticsSearch = v.InferOutput<typeof statisticsSearchSchema>

export const Route = createFileRoute('/_auth/statistics/')({
  // A hand-edited URL falls back to the default period rather than an error.
  validateSearch: (search): StatisticsSearch => {
    const result = v.safeParse(statisticsSearchSchema, search)
    return result.success ? result.output : {}
  },
  beforeLoad: ({ context }) => {
    // UX only: the endpoint checks `statistics:view` and narrows a doctor to themself.
    if (!context.session.permissions.has('statistics:view')) {
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
  const period = search.period ?? 'month'
  const doctor = search.doctor ?? null
  // Defaults stay out of the URL, so `/statistics` is the canonical view.
  const go = (next: { period: StatsPeriod; doctor: string | null }) =>
    void navigate({
      search: (): StatisticsSearch => ({
        ...(next.period === 'month' ? {} : { period: next.period }),
        ...(next.doctor === null ? {} : { doctor: next.doctor }),
      }),
      to: '/statistics',
    })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title1 text-text">{t('title')}</h1>

      <StatisticsOverview
        canFilterByDoctor={session?.permissions.has('statistics:view_all') ?? false}
        clinicId={clinicId}
        doctorId={doctor}
        onDoctorChange={(next) => go({ period, doctor: next })}
        onPeriodChange={(next) => go({ period: next, doctor })}
        period={period}
        showBranch={session?.isAllBranches ?? false}
      />
    </div>
  )
}
