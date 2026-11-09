import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import { Can, useSession } from '@/entities/session'
import { BotAccessPanel } from '@/features/bot-access-manage'
import { dateFormat } from '@/shared/lib/dateFormat'
import { CLINIC_TZ, clinicNow } from '@/shared/lib/datetime'
import { Card } from '@/shared/ui'
import { DashboardMoney } from '@/widgets/dashboard-money'
import { DashboardToday } from '@/widgets/dashboard-today'

/** An id only (§3): a doctor's id is not PHI, a name would be needless. */
const dashboardSearchSchema = v.object({
  doctor: v.optional(v.pipe(v.string(), v.uuid())),
})

type DashboardSearch = v.InferOutput<typeof dashboardSearchSchema>

export const Route = createFileRoute('/_auth/dashboard')({
  // A hand-edited URL falls back to "all doctors" rather than an error page.
  validateSearch: (search): DashboardSearch => {
    const result = v.safeParse(dashboardSearchSchema, search)
    return result.success ? result.output : {}
  },
  component: DashboardPage,
})

/**
 * "Today" — the staff's starting screen, not a report.
 *
 * A doctor sees only their own queue: an appointment's `doctor` is a
 * membership id, the same id the session carries as `membershipId`. The
 * server narrows a doctor's appointments on its own; this is the UX half.
 */
function DashboardPage() {
  const { t, i18n } = useTranslation(['common', 'bot'])
  const { clinicId } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const session = useSession()

  if (session === undefined) return null

  const isDoctor = session.role === 'doctor'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {/* Which day "today" is, in the clinic's zone (§14), not the browser's. */}
        <span className="text-callout text-text-tertiary first-letter:uppercase">
          {dateFormat(i18n.language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: CLINIC_TZ,
          }).format(new Date())}
        </span>
        <h1 className="text-title1 text-text">{t('nav.dashboard')}</h1>
      </div>

      {/* Owner and front desk; a doctor's own money is on their earnings page. */}
      <Can permission="report:view">
        <DashboardMoney clinicId={clinicId} today={clinicNow().date} />
      </Can>

      {isDoctor ? (
        <DashboardToday clinicId={clinicId} doctorId={session.membershipId} />
      ) : (
        <DashboardToday
          clinicId={clinicId}
          doctorFilter={{
            onChange: (doctor) =>
              void navigate({
                search: (): DashboardSearch => (doctor === null ? {} : { doctor }),
                to: '/dashboard',
              }),
          }}
          doctorId={search.doctor ?? null}
        />
      )}

      {/* Doctors only: an owner finds their login under Boshqaruv, an admin has none. */}
      <Can permission="payroll:view_own">
        <Card className="flex max-w-lg flex-col gap-3 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-headline text-text">{t('bot:mine')}</h2>
            <p className="text-caption text-text-secondary">{t('bot:mineHint')}</p>
          </div>
          <BotAccessPanel clinicId={clinicId} target={{ kind: 'mine' }} />
        </Card>
      </Can>
    </div>
  )
}
