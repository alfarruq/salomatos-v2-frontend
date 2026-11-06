import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import type { PatientFilters } from '@/entities/patient'
import { PatientTable } from '@/widgets/patient-table'

/**
 * The shareable half of the list's state.
 *
 * ⛔ **No `search` field, and that absence is the point** (§7.3, §3). A
 * colleague must be able to send a link to "archived patients, page 2" — that is
 * what separates a tool from a toy — but a patient's *name* in the address bar
 * reaches the access log, the `Referer` header of every asset request, the
 * browser's history and whoever is looking at the screen. The search term lives
 * in `useState` inside the widget and never comes here.
 */
const patientsSearchSchema = v.object({
  archived: v.optional(v.boolean()),
  doctor: v.optional(v.pipe(v.string(), v.uuid())),
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

type PatientsSearch = v.InferOutput<typeof patientsSearchSchema>

export const Route = createFileRoute('/_auth/patients/')({
  /*
   * A hand-edited or stale URL must not take the screen down with it — falling
   * back to an unfiltered list is the behaviour a user can recover from.
   */
  validateSearch: (search): PatientsSearch => {
    const result = v.safeParse(patientsSearchSchema, search)
    return result.success ? result.output : {}
  },

  component: PatientsPage,
})

function PatientsPage() {
  const { t } = useTranslation('patients')
  const navigate = useNavigate()
  const search = Route.useSearch()
  // Set by the `_auth` guard, which resolved the session before this rendered.
  const { clinicId } = Route.useRouteContext()

  const filters: Omit<PatientFilters, 'search'> = {
    archived: search.archived ?? false,
    doctorId: search.doctor ?? null,
    page: search.page ?? 1,
  }

  return (
    <div className="flex flex-col gap-6">
      <PatientTable
        clinicId={clinicId}
        filters={filters}
        heading={<h1 className="text-title1 text-text">{t('title')}</h1>}
        onFiltersChange={(next) => {
          /*
           * Undefined rather than the default value, so a default never
           * reaches the URL: `/patients` stays `/patients` instead of becoming
           * `/patients?page=1&doctor=`.
           */
          void navigate({
            search: (): PatientsSearch => ({
              ...(next.archived ? { archived: true } : {}),
              ...(next.doctorId === null ? {} : { doctor: next.doctorId }),
              ...(next.page === 1 ? {} : { page: next.page }),
            }),
            to: '/patients',
          })
        }}
        onOpenPatient={(patientId) => {
          void navigate({ params: { patientId }, to: '/patients/$patientId' })
        }}
      />
    </div>
  )
}
