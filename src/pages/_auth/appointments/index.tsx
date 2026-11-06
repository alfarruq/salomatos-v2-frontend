import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import type { AppointmentFilters, AppointmentView } from '@/entities/appointment'
import { todayCalendarDate } from '@/shared/lib/calendarDate'
import { AppointmentCalendar } from '@/widgets/appointment-calendar'

/**
 * The whole view state is shareable (§3) — unlike a patient search term, a
 * day/week and a date are not PHI, and a colleague being able to send "next
 * Tuesday's day view" is the point of putting it in the URL at all.
 */
const appointmentsSearchSchema = v.object({
  view: v.optional(v.picklist(['day', 'week'])),
  date: v.optional(v.string()),
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  // A staff id, not PHI — the same kind of id `/patients/$patientId` carries.
  doctorId: v.optional(v.pipe(v.string(), v.uuid())),
})

type AppointmentsSearch = v.InferOutput<typeof appointmentsSearchSchema>

/** The clinic plans by the week, so that is what the section opens on. */
const DEFAULT_VIEW: AppointmentView = 'week'

export const Route = createFileRoute('/_auth/appointments/')({
  // A hand-edited or stale URL falls back to this week's view rather than
  // taking the screen down with it.
  validateSearch: (search): AppointmentsSearch => {
    const result = v.safeParse(appointmentsSearchSchema, search)
    return result.success ? result.output : {}
  },

  component: AppointmentsPage,
})

function AppointmentsPage() {
  const { t } = useTranslation('appointments')
  const navigate = useNavigate()
  const search = Route.useSearch()
  // Set by the `_auth` guard, which resolved the session before this rendered.
  const { clinicId } = Route.useRouteContext()

  const filters: AppointmentFilters = {
    view: search.view ?? DEFAULT_VIEW,
    date: search.date ?? todayCalendarDate(),
    ...(search.doctorId === undefined ? {} : { doctorId: search.doctorId }),
  }

  return (
    <div className="flex flex-col">
      <AppointmentCalendar
        clinicId={clinicId}
        filters={filters}
        onOpenPatient={(patientId) => {
          void navigate({ params: { patientId }, to: '/patients/$patientId' })
        }}
        onPageChange={(page) => {
          void navigate({
            search: (previous): AppointmentsSearch => {
              const { page: _current, ...rest } = previous
              return page === 1 ? rest : { ...rest, page }
            },
            to: '/appointments',
          })
        }}
        page={search.page ?? 1}
        title={<h1 className="text-title1 text-text">{t('title')}</h1>}
        onFiltersChange={(next) => {
          // Undefined rather than the default value, so a default never
          // reaches the URL: `/appointments` stays `/appointments` instead of
          // becoming `/appointments?view=day&date=2026-09-27`. `page` is dropped
          // too: another view or date is a different list, starting at page 1.
          void navigate({
            search: (): AppointmentsSearch => ({
              // The widget still types `all`, but no longer offers it.
              ...(next.view === DEFAULT_VIEW || next.view === 'all' ? {} : { view: next.view }),
              ...(next.date === todayCalendarDate() ? {} : { date: next.date }),
              ...(next.doctorId === undefined ? {} : { doctorId: next.doctorId }),
            }),
            to: '/appointments',
          })
        }}
      />
    </div>
  )
}
