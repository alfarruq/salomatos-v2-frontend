import { useQuery, useQueryClient } from '@tanstack/react-query'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Activity, Plus, RotateCcw, SlidersHorizontal, UserPlus, UserRound } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { doctorQueries } from '@/entities/doctor'
import type { PatientFilters, PatientId, PatientListItem } from '@/entities/patient'
import { PatientAvatar, PatientStatusBadge, patientQueries } from '@/entities/patient'
import { Can, useCan } from '@/entities/session'
import { ArchivePatientDialog } from '@/features/patient-archive'
import { CreatePatientDialog } from '@/features/patient-create'
import { EditPatientDialog } from '@/features/patient-edit'
import { PatientSearchInput, usePatientSearch } from '@/features/patient-search'
import { TreatmentComposer } from '@/features/treatment-composer'
import { PAGE_SIZE } from '@/shared/api/pagination'
import { cn } from '@/shared/lib/cn'
import { formatSom } from '@/shared/lib/money'
import { PHONE_QUERY, useMediaQuery } from '@/shared/lib/useMediaQuery'
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  formatSubscriber,
  Pagination,
  QueryBoundary,
  Select,
  subscriberDigitsOf,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/shared/ui'
import { usePatientColumns } from '../model/usePatientColumns'
import { PatientSummary } from './PatientSummary'

interface NewPatientTreatment {
  patientId: PatientId
  doctorId: string | null
}

/*
 * Radix's `Select` hardcodes `""` to mean "nothing selected, show the
 * placeholder" — not available as a real, displayable option value. "All"
 * needs its own sentinel, distinct from any real doctor id.
 */
const FILTER_ALL = 'all'
const ACTIVE = 'active'
const ARCHIVED = 'archived'

export interface PatientTableProps {
  clinicId: string
  /**
   * The shareable half of the filter state, owned by the route's search params.
   * ⛔ `search` is not among them — see `usePatientSearch`.
   */
  filters: Omit<PatientFilters, 'search'>
  onFiltersChange: (next: Omit<PatientFilters, 'search'>) => void
  onOpenPatient: (patientId: PatientId) => void
  /** The page's heading, laid out beside the create button on wider screens. */
  heading: ReactNode
}

/**
 * The patient list: toolbar, table, pagination.
 *
 * A widget rather than a page section because this is where features compose
 * (§3.1) — search, create and the session's permission gate all meet here, and
 * none of them may import each other.
 */
export function PatientTable({
  clinicId,
  filters,
  onFiltersChange,
  onOpenPatient,
  heading,
}: PatientTableProps) {
  const { t } = useTranslation(['patients', 'common'])
  const queryClient = useQueryClient()
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PatientListItem | null>(null)
  const [archiving, setArchiving] = useState<PatientListItem | null>(null)
  const [isFiltersOpen, setFiltersOpen] = useState(false)
  // Set when "add a treatment" was ticked in the new-patient form (§4: the two
  // features meet here, not inside each other).
  const [treatmentFor, setTreatmentFor] = useState<NewPatientTreatment | null>(null)
  const canAddTreatment = useCan('procedure:manage')

  const search = usePatientSearch()
  const query = useQuery(
    patientQueries.list(clinicId, { ...filters, search: search.debouncedTerm }),
  )
  const doctorsQuery = useQuery(doctorQueries.list(clinicId))

  const handleSearchChange = (value: string) => {
    search.setTerm(value)
    // A narrower result set has fewer pages, and staying on page 4 of a
    // one-page result shows an empty table that looks like "no patients".
    if (filters.page !== 1) onFiltersChange({ ...filters, page: 1 })
  }

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, archived: value === ARCHIVED, page: 1 })
  }

  /** A staff UUID, not patient data (§3) — unlike `search`, this may sit in the URL. */
  const handleDoctorChange = (value: string) => {
    onFiltersChange({ ...filters, doctorId: value === FILTER_ALL ? null : value, page: 1 })
  }

  const hasActiveFilters = search.term !== '' || filters.archived || filters.doctorId !== null

  const handleClearFilters = () => {
    search.clear()
    onFiltersChange({ archived: false, doctorId: null, page: 1 })
  }

  const statusOptions = [
    { value: ACTIVE, label: t('patients:status.active') },
    { value: ARCHIVED, label: t('patients:status.archived') },
  ]

  const doctorOptions = [
    { value: FILTER_ALL, label: t('patients:filters.doctorAll') },
    ...(doctorsQuery.data ?? []).map((doctor) => ({
      value: doctor.id,
      label: doctor.fullName,
    })),
  ]

  /**
   * Warms the card before the click lands. The row is already on screen, so
   * the request costs nothing the user waits for, and opening a patient then
   * renders from cache.
   */
  const prefetchPatient = (patientId: PatientId) => {
    void queryClient.prefetchQuery(patientQueries.detail(clinicId, patientId))
  }

  const columns = usePatientColumns({ onArchive: setArchiving, onEdit: setEditing })
  const isPhone = useMediaQuery(PHONE_QUERY)
  const extraFilterCount = filters.doctorId === null ? 0 : 1

  return (
    <div className="flex flex-col gap-4">
      {isPhone ? (
        heading
      ) : (
        <div className="flex items-center justify-between gap-3">
          {heading}
          {/* UX only — Django decides what may actually be created (§9.1). */}
          <Can permission="patient:manage">
            <Button
              iconLeft={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => setCreateOpen(true)}
              variant="primary"
            >
              {t('patients:create.submit')}
            </Button>
          </Can>
        </div>
      )}

      <PatientSummary clinicId={clinicId} />

      {isPhone ? (
        <div className="flex flex-col gap-3">
          <PatientSearchInput
            onChange={handleSearchChange}
            onClear={() => handleSearchChange('')}
            value={search.term}
          />
          {/* Status is the filter used most, so it stays one tap away; the
              rest wait behind "Filter" in a sheet rather than three selects
              stacked above the list. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            <FilterChip onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              {t('patients:filters.title')}
              {extraFilterCount > 0 ? (
                <span className="tabular-nums">· {extraFilterCount}</span>
              ) : null}
            </FilterChip>
            {statusOptions.map((option) => (
              <FilterChip
                isActive={(filters.archived ? ARCHIVED : ACTIVE) === option.value}
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
          <Dialog
            footer={
              <Button className="w-full" onClick={() => setFiltersOpen(false)} variant="primary">
                {t('patients:filters.apply')}
              </Button>
            }
            onOpenChange={setFiltersOpen}
            open={isFiltersOpen}
            title={t('patients:filters.title')}
          >
            <div className="flex flex-col gap-4">
              {/* Not shown — the select's own visible options already say what it
              filters. Kept for assistive tech, which still needs a name for it. */}
              <label className="sr-only" htmlFor="patient-doctor-filter">
                {t('patients:filters.doctorLabel')}
              </label>
              <Select
                className="w-full"
                icon={<UserRound className="size-4" />}
                id="patient-doctor-filter"
                onValueChange={handleDoctorChange}
                options={doctorOptions}
                size="sm"
                value={filters.doctorId ?? FILTER_ALL}
              />
            </div>
          </Dialog>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
              <PatientSearchInput
                onChange={handleSearchChange}
                onClear={() => handleSearchChange('')}
                value={search.term}
              />
            </div>

            <label className="sr-only" htmlFor="patient-status-filter">
              {t('patients:filters.statusLabel')}
            </label>
            <Select
              className="w-auto shrink-0"
              icon={<Activity className="size-4" />}
              id="patient-status-filter"
              onValueChange={handleStatusChange}
              options={statusOptions}
              size="sm"
              value={filters.archived ? ARCHIVED : ACTIVE}
            />

            {/* Not shown — the select's own visible options already say what it
              filters. Kept for assistive tech, which still needs a name for it. */}
            <label className="sr-only" htmlFor="patient-doctor-filter">
              {t('patients:filters.doctorLabel')}
            </label>
            <Select
              className="w-auto shrink-0"
              icon={<UserRound className="size-4" />}
              id="patient-doctor-filter"
              onValueChange={handleDoctorChange}
              options={doctorOptions}
              size="sm"
              value={filters.doctorId ?? FILTER_ALL}
            />

            {/* Only when there is something to clear: a reset button over an
                unfiltered list is a control that does nothing. */}
            {hasActiveFilters ? (
              <Button
                iconLeft={<RotateCcw aria-hidden="true" className="size-4" />}
                onClick={handleClearFilters}
                size="sm"
                variant="ghost"
              >
                {t('patients:filters.clear')}
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {isPhone ? (
        <Can permission="patient:manage">
          <Button
            iconLeft={<UserPlus aria-hidden="true" className="size-4" />}
            isFloatingOnPhone
            onClick={() => setCreateOpen(true)}
            size="sm"
            variant="primary"
          >
            {t('patients:create.submit')}
          </Button>
        </Can>
      ) : null}

      <QueryBoundary
        empty={
          <EmptyState
            /*
             * §11.6 — an empty screen invites the next action. Which action
             * depends on why it is empty: a clinic with no patients yet should
             * be offered the form, while a search that matched nothing should
             * be offered its way back, because adding a patient is not what
             * that person was trying to do.
             */
            action={
              search.debouncedTerm === '' ? (
                <Can permission="patient:manage">
                  <Button onClick={() => setCreateOpen(true)} variant="primary">
                    {t('patients:create.submit')}
                  </Button>
                </Can>
              ) : (
                <Button onClick={() => handleSearchChange('')} variant="secondary">
                  {t('patients:empty.showAll')}
                </Button>
              )
            }
            description={
              search.debouncedTerm === ''
                ? t('patients:empty.description')
                : t('patients:empty.searchDescription')
            }
            title={
              search.debouncedTerm === '' ? t('patients:empty.title') : t('patients:empty.noMatch')
            }
          />
        }
        error={({ retry }) => (
          <ErrorState
            description={t('common:error.pageBody')}
            retryLabel={t('common:action.retry')}
            title={t('common:error.pageTitle')}
            // See the detail page: `exactOptionalPropertyTypes` distinguishes
            // an absent prop from one set to undefined.
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={(page) => page.results.length === 0}
        loading={
          // TableSkeleton renders a <tbody>, so it needs the table around it.
          <Table density="compact">
            <TableSkeleton columns={columns.length} rows={PAGE_SIZE} />
          </Table>
        }
        query={query}
      >
        {(page) => (
          <>
            {isPhone ? (
              <PatientCards onOpenPatient={onOpenPatient} rows={page.results} />
            ) : (
              <PatientRows
                columns={columns}
                onOpenPatient={onOpenPatient}
                onPrefetch={prefetchPatient}
                rows={page.results}
              />
            )}

            <Pagination
              hasNext={page.next !== null}
              hasPrevious={page.previous !== null}
              isLoading={query.isFetching}
              nextLabel={t('common:action.next')}
              onNext={() => onFiltersChange({ ...filters, page: filters.page + 1 })}
              onPrevious={() => onFiltersChange({ ...filters, page: filters.page - 1 })}
              previousLabel={t('common:action.previous')}
              /*
               * A real total, which cursor pagination could not have given
               * (see the component's own note) — `count` is what makes a
               * position line expressible here at all.
               *
               * Numbers only, no counted noun: Russian would need three plural
               * forms for "patients" and the position is unambiguous without
               * it.
               */
              summary={t('patients:pagination.summary', {
                count: page.count,
                from: (filters.page - 1) * PAGE_SIZE + 1,
                to: Math.min(filters.page * PAGE_SIZE, page.count),
              })}
            />
          </>
        )}
      </QueryBoundary>

      <CreatePatientDialog
        clinicId={clinicId}
        offerTreatment={canAddTreatment}
        onCreated={(patient, followUp) => {
          if (followUp.addTreatment) {
            setTreatmentFor({ patientId: patient.id, doctorId: followUp.doctorId })
          }
        }}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />

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

      {editing === null ? null : (
        <EditPatientDialog
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          open
          patient={editing}
        />
      )}

      {archiving === null ? null : (
        <ArchivePatientDialog
          clinicId={clinicId}
          onArchived={() => setArchiving(null)}
          onOpenChange={(open: boolean) => {
            if (!open) setArchiving(null)
          }}
          open
          patient={archiving}
        />
      )}
    </div>
  )
}

function PatientRows({
  rows,
  columns,
  onOpenPatient,
  onPrefetch,
}: {
  rows: PatientListItem[]
  columns: ReturnType<typeof usePatientColumns>
  onOpenPatient: (patientId: PatientId) => void
  onPrefetch: (patientId: PatientId) => void
}) {
  /*
   * Headless table, so the markup stays `shared/ui`'s and the density,
   * focus ring and touch targets from §11.7 come for free.
   *
   * ⛔ Not virtualised, and the roadmap's "100+ rows → react-virtual" does not
   * apply: the server paginates at `PAGE_SIZE`, so a hundred rows never
   * reach the DOM. Adding the dependency would cost bundle for a condition
   * that cannot occur until the page size is made configurable.
   */
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <Table density="compact">
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead align={header.column.columnDef.meta?.align ?? 'left'} key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>

      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            isInteractive
            key={row.id}
            onClick={() => onOpenPatient(row.original.id)}
            onFocus={() => onPrefetch(row.original.id)}
            onMouseEnter={() => onPrefetch(row.original.id)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell align={cell.column.columnDef.meta?.align ?? 'left'} key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * The phone layout: one tappable row per patient carrying what the desk
 * scans for (name, phone, status). Edit and archive stay on the card page, a
 * tap away, rather than behind a third control squeezed into the row.
 */
function PatientCards({
  rows,
  onOpenPatient,
}: {
  rows: PatientListItem[]
  onOpenPatient: (patientId: PatientId) => void
}) {
  const { t, i18n } = useTranslation(['patients', 'common'])

  return (
    <ul aria-label={t('patients:title')} className="divide-y divide-border rounded-card bg-surface">
      {rows.map((patient) => (
        <li key={patient.id}>
          <button
            className={cn(
              'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left',
              'transition-colors duration-150 ease-out-apple active:bg-sunken',
            )}
            onClick={() => onOpenPatient(patient.id)}
            type="button"
          >
            <PatientAvatar className="text-caption" name={patient.fullName} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-body font-medium text-text">{patient.fullName}</span>
                {patient.status === 'archived' ? (
                  <PatientStatusBadge status={patient.status} />
                ) : null}
              </span>
              {patient.phoneNumber === null ? null : (
                <span className="text-callout text-text-secondary tabular-nums">
                  {`+998-${formatSubscriber(subscriberDigitsOf(patient.phoneNumber))}`}
                </span>
              )}
              {patient.debt === null || patient.debt <= 0 ? null : (
                <span className="text-callout font-medium text-warning tabular-nums">
                  {t('patients:column.debt')}:{' '}
                  {formatSom(patient.debt, i18n.language, t('common:currency.som'))}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function FilterChip({
  isActive = false,
  onClick,
  children,
}: {
  isActive?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      aria-pressed={isActive}
      className={cn(
        'flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-callout font-medium',
        'transition-colors duration-150 ease-out-apple',
        isActive
          ? 'border-transparent bg-text text-canvas'
          : 'border-border-strong bg-surface text-text',
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}
