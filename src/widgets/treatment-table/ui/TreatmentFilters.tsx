import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { doctorQueries } from '@/entities/doctor'
import { defaultPatientFilters, patientQueries } from '@/entities/patient'
import type { TreatmentListFilters, TreatmentStatus } from '@/entities/treatment'
import { treatmentTypeQueries } from '@/entities/treatment-type'
import { PatientSearchInput, usePatientSearch } from '@/features/patient-search'
import { cn } from '@/shared/lib/cn'
import { Input, Select } from '@/shared/ui'

/** Radix Select treats `""` as "nothing chosen", so "all" needs a real value. */
const FILTER_ALL = 'all'
/** Below this a search matches half the clinic and helps nobody. */
const MIN_SEARCH_LENGTH = 2
const MAX_RESULTS = 6

export interface TreatmentFiltersProps {
  clinicId: string
  filters: TreatmentListFilters
  onFiltersChange: (filters: TreatmentListFilters) => void
}

/** Every change goes back to page 1 — page 3 of a narrower list may not exist. */
export function TreatmentFilters({ clinicId, filters, onFiltersChange }: TreatmentFiltersProps) {
  const { t } = useTranslation('treatments')
  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  const typesQuery = useQuery(treatmentTypeQueries.list(clinicId))

  const change = (patch: Partial<TreatmentListFilters>) =>
    onFiltersChange({ ...filters, ...patch, page: 1 })
  const idOrNull = (value: string) => (value === FILTER_ALL ? null : value)

  return (
    <div className="flex flex-wrap items-start gap-2">
      <PatientFilter
        clinicId={clinicId}
        onChange={(patientId) => change({ patientId })}
        patientId={filters.patientId}
      />

      <Select
        aria-label={t('filters.doctorLabel')}
        className="w-auto shrink-0"
        onValueChange={(value) => change({ doctorId: idOrNull(value) })}
        options={[
          { value: FILTER_ALL, label: t('filters.doctorAll') },
          ...(doctorsQuery.data ?? []).map((doctor) => ({
            value: doctor.id,
            label: doctor.fullName,
          })),
        ]}
        size="sm"
        value={filters.doctorId ?? FILTER_ALL}
      />

      <Select
        aria-label={t('filters.typeLabel')}
        className="w-auto shrink-0"
        onValueChange={(value) => change({ treatmentTypeId: idOrNull(value) })}
        options={[
          { value: FILTER_ALL, label: t('filters.typeAll') },
          ...(typesQuery.data ?? []).map((type) => ({ value: type.id, label: type.name })),
        ]}
        size="sm"
        value={filters.treatmentTypeId ?? FILTER_ALL}
      />

      <Select
        aria-label={t('filters.statusLabel')}
        className="w-auto shrink-0"
        onValueChange={(value) =>
          change({ status: value === FILTER_ALL ? null : (value as TreatmentStatus) })
        }
        options={[
          { value: FILTER_ALL, label: t('filters.statusAll') },
          { value: 'done', label: t('status.done') },
          { value: 'inProgress', label: t('status.inProgress') },
          { value: 'voided', label: t('status.voided') },
        ]}
        size="sm"
        value={filters.status ?? FILTER_ALL}
      />

      {/* One range: the two days wrap together on a narrow screen. */}
      <div className="flex items-center gap-2">
        <Input
          aria-label={t('filters.dateFrom')}
          className="w-40"
          max={filters.dateTo ?? undefined}
          onChange={(event) =>
            change({ dateFrom: event.target.value === '' ? null : event.target.value })
          }
          size="sm"
          type="date"
          value={filters.dateFrom ?? ''}
        />
        <span aria-hidden="true" className="text-text-tertiary">
          –
        </span>
        <Input
          aria-label={t('filters.dateTo')}
          className="w-40"
          min={filters.dateFrom ?? undefined}
          onChange={(event) =>
            change({ dateTo: event.target.value === '' ? null : event.target.value })
          }
          size="sm"
          type="date"
          value={filters.dateTo ?? ''}
        />
      </div>
    </div>
  )
}

/**
 * Search by name, then pick: the filter itself is the patient's id.
 *
 * ⛔ The typed name stays in `usePatientSearch`'s state and never reaches the
 * URL (§3) — only the picked id does, and the chip reads the name back from
 * the patient record rather than from the address bar.
 */
function PatientFilter({
  clinicId,
  patientId,
  onChange,
}: {
  clinicId: string
  patientId: string | null
  onChange: (patientId: string | null) => void
}) {
  const { t } = useTranslation('treatments')
  const search = usePatientSearch()
  const term = search.debouncedTerm.trim()
  const isSearching = patientId === null && term.length >= MIN_SEARCH_LENGTH

  const resultsQuery = useQuery({
    ...patientQueries.list(clinicId, { ...defaultPatientFilters, search: term }),
    enabled: isSearching,
  })
  const pickedQuery = useQuery({
    ...patientQueries.detail(clinicId, patientId ?? ''),
    enabled: patientId !== null,
  })

  if (patientId !== null) {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-full border border-accent bg-accent-soft pr-1 pl-3 text-callout text-accent-text pointer-coarse:min-h-11">
        <span className="max-w-48 truncate">
          {pickedQuery.data?.fullName ?? t('filters.patientLoading')}
        </span>
        <button
          aria-label={t('filters.patientClear')}
          className="flex size-6 items-center justify-center rounded-full hover:bg-accent/10 pointer-coarse:size-11"
          onClick={() => onChange(null)}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </span>
    )
  }

  const results = resultsQuery.data?.results.slice(0, MAX_RESULTS) ?? []

  return (
    <div className="relative w-full sm:w-72">
      <PatientSearchInput onChange={search.setTerm} onClear={search.clear} value={search.term} />

      {isSearching ? (
        <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-card border border-border bg-elevated p-1 shadow-popover">
          {resultsQuery.isPending ? (
            <p className="px-3 py-2 text-callout text-text-secondary">{t('filters.searching')}</p>
          ) : resultsQuery.isError ? (
            <p className="px-3 py-2 text-callout text-danger" role="alert">
              {t('filters.searchFailed')}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-callout text-text-secondary">{t('filters.noPatients')}</p>
          ) : (
            <ul aria-label={t('filters.patientResults')}>
              {results.map((patient) => (
                <li key={patient.id}>
                  <button
                    className={cn(
                      'flex min-h-11 w-full flex-col justify-center rounded-control px-3 py-1 text-left',
                      'transition-colors duration-150 ease-out-apple hover:bg-sunken',
                    )}
                    onClick={() => {
                      search.clear()
                      onChange(patient.id)
                    }}
                    type="button"
                  >
                    <span className="text-callout text-text">{patient.fullName}</span>
                    {patient.phoneNumber === null ? null : (
                      <span className="text-caption text-text-secondary">
                        {patient.phoneNumber}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
