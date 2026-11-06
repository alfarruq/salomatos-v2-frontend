import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarPlus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultPatientFilters, type PatientId, patientQueries } from '@/entities/patient'
import { Can, useCan } from '@/entities/session'
import { CreateAppointmentDialog } from '@/features/appointment-create'
import { CreatePatientDialog } from '@/features/patient-create'
import { PatientSearchInput, usePatientSearch } from '@/features/patient-search'
import { TreatmentComposer } from '@/features/treatment-composer'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui'

/** Below this a search matches half the clinic and helps nobody. */
const MIN_SEARCH_LENGTH = 2
const MAX_RESULTS = 5

interface NewPatientTreatment {
  patientId: PatientId
  doctorId: string | null
}

export interface QuickActionsProps {
  clinicId: string
  today: string
  /** The empty queue's own button opens the same dialog, so its state lives with the caller. */
  isAppointmentOpen: boolean
  onAppointmentOpenChange: (open: boolean) => void
}

/**
 * The three things a desk does all day, composed here because features may
 * not import one another (§4). Every button is a UX gate only — the server
 * decides what is actually allowed.
 */
export function QuickActions({
  clinicId,
  today,
  isAppointmentOpen,
  onAppointmentOpenChange,
}: QuickActionsProps) {
  const { t } = useTranslation('dashboard')
  const [isPatientOpen, setPatientOpen] = useState(false)
  // Set when "add a treatment" was ticked in the new-patient form (§4: the two
  // features meet here, not inside each other).
  const [treatmentFor, setTreatmentFor] = useState<NewPatientTreatment | null>(null)
  const canAddTreatment = useCan('procedure:manage')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Can permission="patient:view">
        <PatientQuickSearch clinicId={clinicId} />
      </Can>

      <div className="flex flex-wrap gap-2">
        <Can permission="appointment:manage">
          <Button
            iconLeft={<CalendarPlus aria-hidden="true" className="size-4" />}
            isFloatingOnPhone
            onClick={() => onAppointmentOpenChange(true)}
            variant="primary"
          >
            {t('actions.newAppointment')}
          </Button>
          <CreateAppointmentDialog
            clinicId={clinicId}
            defaultDate={today}
            onOpenChange={onAppointmentOpenChange}
            open={isAppointmentOpen}
          />
        </Can>
        <Can permission="patient:manage">
          <Button
            iconLeft={<UserPlus aria-hidden="true" className="size-4" />}
            onClick={() => setPatientOpen(true)}
            variant="secondary"
          >
            {t('actions.newPatient')}
          </Button>
          <CreatePatientDialog
            clinicId={clinicId}
            offerTreatment={canAddTreatment}
            onCreated={(patient, followUp) => {
              if (followUp.addTreatment) {
                setTreatmentFor({ patientId: patient.id, doctorId: followUp.doctorId })
              }
            }}
            onOpenChange={setPatientOpen}
            open={isPatientOpen}
          />
        </Can>
      </div>

      {treatmentFor === null ? null : (
        <TreatmentComposer
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setTreatmentFor(null)
          }}
          open
          patientId={treatmentFor.patientId}
          initialDoctorId={treatmentFor.doctorId}
        />
      )}
    </div>
  )
}

/**
 * ⛔ The term lives in `usePatientSearch`'s state and nowhere else — never the
 * URL (§3). Results link by id only.
 */
function PatientQuickSearch({ clinicId }: { clinicId: string }) {
  const { t } = useTranslation('dashboard')
  const search = usePatientSearch()
  const term = search.debouncedTerm.trim()
  const isActive = term.length >= MIN_SEARCH_LENGTH

  const query = useQuery({
    ...patientQueries.list(clinicId, { ...defaultPatientFilters, search: term }),
    enabled: isActive,
  })

  const results = query.data?.results.slice(0, MAX_RESULTS) ?? []

  return (
    <div className="relative min-w-0 flex-1">
      <PatientSearchInput onChange={search.setTerm} onClear={search.clear} value={search.term} />

      {isActive ? (
        <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-card border border-border bg-elevated p-1 shadow-popover">
          {query.isPending ? (
            <p className="px-3 py-2 text-callout text-text-secondary">{t('search.searching')}</p>
          ) : query.isError ? (
            <p className="px-3 py-2 text-callout text-danger" role="alert">
              {t('search.failed')}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-callout text-text-secondary">{t('search.noResults')}</p>
          ) : (
            <ul aria-label={t('search.results')}>
              {results.map((patient) => (
                <li key={patient.id}>
                  <Link
                    className={cn(
                      'flex min-h-11 flex-col justify-center rounded-control px-3 py-1 outline-none',
                      'transition-colors duration-150 ease-out-apple hover:bg-sunken',
                      'focus-visible:ring-2 focus-visible:ring-accent',
                    )}
                    params={{ patientId: String(patient.id) }}
                    to="/patients/$patientId"
                  >
                    <span className="text-callout text-text">{patient.fullName}</span>
                    {patient.phoneNumber === null ? null : (
                      <span className="text-caption text-text-secondary">
                        {patient.phoneNumber}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
