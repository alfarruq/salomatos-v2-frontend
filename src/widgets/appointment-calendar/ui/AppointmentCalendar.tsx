import { useQuery } from '@tanstack/react-query'
import { Ban, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type Appointment,
  type AppointmentFilters,
  AppointmentStatusBadge,
  appointmentQueries,
  isClosedAppointmentStatus,
} from '@/entities/appointment'
import { doctorQueries } from '@/entities/doctor'
import { CancelAppointmentDialog } from '@/features/appointment-cancel'
import { CreateAppointmentDialog } from '@/features/appointment-create'
import { EditAppointmentDialog } from '@/features/appointment-edit'
import { PAGE_SIZE, type Page } from '@/shared/api/pagination'
import { formatCalendarDate, parseCalendarDate, todayCalendarDate } from '@/shared/lib/calendarDate'
import { cn } from '@/shared/lib/cn'
import { useDebounce } from '@/shared/lib/useDebounce'
import { PHONE_QUERY, useMediaQuery } from '@/shared/lib/useMediaQuery'
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  QueryBoundary,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/shared/ui'
import { shiftCalendarDate } from '../model/dateNav'
import { AppointmentDayStrip } from './AppointmentDayStrip'
import {
  AppointmentWeekBoard,
  AppointmentWeekBoardSkeleton,
  AppointmentWeekHeader,
} from './AppointmentWeekBoard'

const SEARCH_DEBOUNCE_MS = 300

/** The select's "no doctor filter" option; real options are UUIDs. */
const ALL_DOCTORS = 'all'

export interface AppointmentCalendarProps {
  clinicId: string
  /** The shareable half of the view state, owned by the route's search params. */
  filters: AppointmentFilters
  onFiltersChange: (next: AppointmentFilters) => void
  /** Server page for the all view; day and week always read every page. */
  page: number
  onPageChange: (page: number) => void
  /** Every appointment belongs to a registered patient, so a row always opens a card. */
  onOpenPatient: (patientId: string) => void
  /** The page heading — shares the date picker's row on a phone, sits above the toolbar otherwise. */
  title: ReactNode
}

/** Shown when the server had nothing to send for a cell. */
const EMPTY = '—'

/**
 * The clinic's schedule — day, week or all appointments — with the actions
 * that manage it.
 *
 * A widget rather than a page section (§3.1): create, edit and cancel each
 * live in their own feature, and this is where they compose.
 */
export function AppointmentCalendar({
  clinicId,
  filters: routeFilters,
  onFiltersChange,
  page,
  onPageChange,
  onOpenPatient,
  title,
}: AppointmentCalendarProps) {
  const { t, i18n } = useTranslation(['appointments', 'common'])
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)

  const openAppointment = (appointment: Appointment) => onOpenPatient(appointment.patientId)

  // PHI (§3): a name/phone search term never reaches the URL, unlike `filters`.
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS).trim().toLowerCase()

  const isPhone = useMediaQuery(PHONE_QUERY)
  // Phone is date-only: a shared week/all link still opens as one day there.
  const filters: AppointmentFilters =
    isPhone && routeFilters.view !== 'day' ? { ...routeFilters, view: 'day' } : routeFilters
  // Day and week are bounded by their dates and stay whole; only `all` can
  // grow past what one screen should load at once.
  const isPaged = filters.view === 'all'
  const dayQuery = useQuery({
    ...appointmentQueries.list(clinicId, filters),
    enabled: !isPaged,
    select: (results): Page<Appointment> => ({
      count: results.length,
      next: null,
      previous: null,
      results,
    }),
  })
  const pageQuery = useQuery({
    ...appointmentQueries.page(clinicId, filters, page),
    enabled: isPaged,
  })
  const query = isPaged ? pageQuery : dayQuery

  // Carried over whenever the view or date is replaced wholesale, so changing
  // the period never silently drops the doctor being looked at.
  const doctorFilter =
    routeFilters.doctorId === undefined ? {} : { doctorId: routeFilters.doctorId }

  const selectDate = (value: string) => {
    // An emptied or half-typed date input reports '' — keep the current day.
    // Picking a date always means "show me that day", whichever view was open.
    if (parseCalendarDate(value) !== null) {
      onFiltersChange({ view: 'day', date: value, ...doctorFilter })
    }
  }

  // A failed doctor list leaves only "all doctors": the schedule itself still works.
  const doctorsQuery = useQuery(doctorQueries.list(clinicId))
  const doctorSelect = (
    <Select
      aria-label={t('appointments:filter.doctor')}
      className={cn(!isPhone && 'w-48')}
      onValueChange={(value) => {
        const { doctorId: _current, ...rest } = routeFilters
        onFiltersChange(value === ALL_DOCTORS ? rest : { ...rest, doctorId: value })
      }}
      options={[
        { value: ALL_DOCTORS, label: t('appointments:filter.allDoctors') },
        ...(doctorsQuery.data ?? []).map((doctor) => ({
          value: doctor.id,
          label: doctor.fullName,
        })),
      ]}
      size="sm"
      value={routeFilters.doctorId === undefined ? ALL_DOCTORS : String(routeFilters.doctorId)}
    />
  )

  const searchInput = (
    <Input
      className="max-w-sm"
      onChange={(event) => setSearchTerm(event.target.value)}
      placeholder={t('appointments:search.placeholder')}
      size="sm"
      type="search"
      value={searchTerm}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {/* pb-2 on top of the column's gap keeps the page's 24px heading spacing.
          Equal outer columns keep the search centred on the page, not in the gap
          the heading leaves. */}
      {isPhone ? null : (
        <div className="grid grid-cols-[1fr_minmax(0,24rem)_1fr] items-center gap-4 pb-2">
          {title}
          {searchInput}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isPhone ? title : null}
        <div
          className={cn(
            'flex flex-wrap items-center gap-2',
            // Shrinks the date input rather than wrapping it under the heading at 360px.
            isPhone && 'min-w-0 flex-1 justify-end',
          )}
        >
          {isPhone ? (
            <Input
              aria-label={t('appointments:form.date')}
              className="w-full max-w-48"
              onChange={(event) => selectDate(event.target.value)}
              type="date"
              value={filters.date}
            />
          ) : (
            <fieldset
              aria-label={t('appointments:view.label')}
              className="m-0 flex gap-1 border-0 p-0"
            >
              {(['day', 'week'] as const).map((view) => (
                <Button
                  key={view}
                  // Switching always lands on today rather than keeping
                  // whatever day was mid-navigation in the other view.
                  onClick={() =>
                    onFiltersChange({ view, date: todayCalendarDate(), ...doctorFilter })
                  }
                  size="sm"
                  variant={filters.view === view ? 'primary' : 'secondary'}
                >
                  {t(`appointments:view.${view}`)}
                </Button>
              ))}
            </fieldset>
          )}

          {isPhone ? null : filters.view === 'day' ? (
            <div className="flex items-center gap-1">
              <Button
                aria-label={t('appointments:view.previousDay')}
                onClick={() =>
                  onFiltersChange({ ...filters, date: shiftCalendarDate(filters.date, -1) })
                }
                size="sm"
                variant="ghost"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <Input
                aria-label={t('appointments:form.date')}
                className="w-40"
                onChange={(event) => selectDate(event.target.value)}
                size="sm"
                type="date"
                value={filters.date}
              />
              <Button
                aria-label={t('appointments:view.nextDay')}
                onClick={() =>
                  onFiltersChange({ ...filters, date: shiftCalendarDate(filters.date, 1) })
                }
                size="sm"
                variant="ghost"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : (
            // The week's reference day, so the field never reads as an empty "mm/dd/yyyy".
            <Input
              aria-label={t('appointments:form.date')}
              className="w-40"
              onChange={(event) => selectDate(event.target.value)}
              size="sm"
              type="date"
              value={filters.date}
            />
          )}

          {isPhone ? null : doctorSelect}
        </div>

        <Button
          iconLeft={<Plus aria-hidden="true" className="size-4" />}
          isFloatingOnPhone
          onClick={() => setCreateOpen(true)}
          size="sm"
          variant="primary"
        >
          {t('appointments:create.submit')}
        </Button>
      </div>

      {!isPhone && filters.view === 'week' ? (
        <AppointmentWeekHeader
          onNextWeek={() =>
            onFiltersChange({ ...filters, date: shiftCalendarDate(filters.date, 7) })
          }
          onPreviousWeek={() =>
            onFiltersChange({ ...filters, date: shiftCalendarDate(filters.date, -7) })
          }
          referenceDate={filters.date}
        />
      ) : null}

      {isPhone ? (
        <AppointmentDayStrip
          onSelect={(date) => onFiltersChange({ ...filters, date })}
          selected={filters.date}
        />
      ) : null}

      {isPhone ? (
        <div className="grid grid-cols-2 gap-2">
          {searchInput}
          {doctorSelect}
        </div>
      ) : null}

      <QueryBoundary
        empty={
          <EmptyState
            action={
              <Button onClick={() => setCreateOpen(true)} variant="primary">
                {t('appointments:create.submit')}
              </Button>
            }
            description={t('appointments:empty.description')}
            title={t('appointments:empty.title')}
          />
        }
        error={({ retry }) => (
          <ErrorState
            description={t('common:error.pageBody')}
            retryLabel={t('common:action.retry')}
            title={t('common:error.pageTitle')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        loading={
          filters.view === 'week' ? (
            <AppointmentWeekBoardSkeleton />
          ) : (
            <Table density="compact">
              <TableSkeleton columns={filters.view === 'day' ? 5 : 6} rows={6} />
            </Table>
          )
        }
        isEmpty={(data) => data.results.length === 0}
        query={query}
      >
        {({ results: allAppointments }) => {
          const matched =
            debouncedSearch === ''
              ? allAppointments
              : allAppointments.filter(
                  (appointment) =>
                    appointment.fullName.toLowerCase().includes(debouncedSearch) ||
                    (appointment.phoneNumber?.toLowerCase().includes(debouncedSearch) ?? false),
                )

          if (matched.length === 0) {
            return <p className="text-body text-text-secondary">{t('appointments:search.empty')}</p>
          }

          if (filters.view === 'week') {
            return (
              <AppointmentWeekBoard
                appointments={matched}
                onCancel={setCancelling}
                onEdit={setEditing}
                onOpen={openAppointment}
                referenceDate={filters.date}
              />
            )
          }

          // Defensive: nothing about the endpoint's ordering is confirmed yet
          // (see `entities/appointment/api/queries.ts`), and a schedule shown
          // out of order is worse than a table shown out of order elsewhere.
          const sorted = [...matched].sort((a, b) =>
            a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
          )

          if (isPhone) {
            return (
              <AppointmentList
                appointments={sorted}
                onCancel={setCancelling}
                onEdit={setEditing}
                onOpen={openAppointment}
                showDate={filters.view !== 'day'}
              />
            )
          }

          return (
            <Table density="compact">
              <TableHeader>
                <TableRow>
                  {filters.view === 'day' ? null : (
                    <TableHead>{t('appointments:column.date')}</TableHead>
                  )}
                  <TableHead>{t('appointments:column.time')}</TableHead>
                  <TableHead>{t('appointments:column.patient')}</TableHead>
                  <TableHead>{t('appointments:column.doctor')}</TableHead>
                  <TableHead>{t('appointments:column.status')}</TableHead>
                  <TableHead align="right">{t('common:action.edit')}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sorted.map((appointment) => (
                  <TableRow
                    isInteractive
                    key={appointment.id}
                    onClick={() => openAppointment(appointment)}
                  >
                    {filters.view === 'day' ? null : (
                      <TableCell>
                        {formatCalendarDate(appointment.date, i18n.language) ?? EMPTY}
                      </TableCell>
                    )}
                    <TableCell>{appointment.time}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-text">{appointment.fullName}</span>
                        {appointment.phoneNumber === null ? null : (
                          <span className="text-caption text-text-secondary">
                            {appointment.phoneNumber}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{appointment.doctorName ?? EMPTY}</TableCell>
                    <TableCell>
                      <AppointmentStatusBadge status={appointment.status} />
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label={`${t('common:action.edit')} — ${appointment.fullName}`}
                          onClick={(event) => {
                            // The row itself opens the patient.
                            event.stopPropagation()
                            setEditing(appointment)
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        {isClosedAppointmentStatus(appointment.status) ? null : (
                          <Button
                            aria-label={`${t('appointments:cancel.confirm')} — ${appointment.fullName}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setCancelling(appointment)
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            <Ban aria-hidden="true" className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        }}
      </QueryBoundary>

      {isPaged && query.data !== undefined && query.data.count > 0 ? (
        <Pagination
          hasNext={query.data.next !== null}
          hasPrevious={query.data.previous !== null}
          isLoading={query.isFetching}
          nextLabel={t('common:action.next')}
          onNext={() => onPageChange(page + 1)}
          onPrevious={() => onPageChange(page - 1)}
          previousLabel={t('common:action.previous')}
          summary={t('appointments:pagination.summary', {
            count: query.data.count,
            from: (page - 1) * PAGE_SIZE + 1,
            to: Math.min(page * PAGE_SIZE, query.data.count),
          })}
        />
      ) : null}

      <CreateAppointmentDialog
        clinicId={clinicId}
        defaultDate={filters.date}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />

      {editing === null ? null : (
        <EditAppointmentDialog
          appointment={editing}
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          open
        />
      )}

      {cancelling === null ? null : (
        <CancelAppointmentDialog
          appointment={cancelling}
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setCancelling(null)
          }}
          open
        />
      )}
    </div>
  )
}

/**
 * Phone layout of the day/all table: time leads each row because that is
 * what staff scan for, and nothing has to scroll sideways.
 */
function AppointmentList({
  appointments,
  showDate,
  onEdit,
  onCancel,
  onOpen,
}: {
  appointments: Appointment[]
  showDate: boolean
  onOpen: (appointment: Appointment) => void
  onEdit: (appointment: Appointment) => void
  onCancel: (appointment: Appointment) => void
}) {
  const { t, i18n } = useTranslation(['appointments', 'common'])

  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
      {appointments.map((appointment) => (
        <li className="flex min-h-16 items-center gap-1 pr-1" key={appointment.id}>
          <button
            className={cn(
              'flex min-w-0 flex-1 items-center gap-3 self-stretch py-2 pl-4 text-left',
              'transition-colors duration-150 ease-out-apple active:bg-sunken',
            )}
            onClick={() => onOpen(appointment)}
            type="button"
          >
            <span className="flex w-14 shrink-0 flex-col">
              {showDate ? (
                <span className="text-caption text-text-tertiary">
                  {formatCalendarDate(appointment.date, i18n.language) ?? EMPTY}
                </span>
              ) : null}
              <span className="text-body font-semibold tabular-nums text-text">
                {appointment.time}
              </span>
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-body font-medium text-text">
                {appointment.fullName}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <AppointmentStatusBadge status={appointment.status} />
                <span className="truncate text-caption text-text-secondary">
                  {appointment.doctorName ?? appointment.phoneNumber ?? EMPTY}
                </span>
              </span>
            </span>
          </button>

          <div className="flex shrink-0">
            <Button
              aria-label={`${t('common:action.edit')} — ${appointment.fullName}`}
              className="size-11 px-0"
              onClick={() => onEdit(appointment)}
              size="sm"
              variant="ghost"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </Button>
            {isClosedAppointmentStatus(appointment.status) ? null : (
              <Button
                aria-label={`${t('appointments:cancel.confirm')} — ${appointment.fullName}`}
                className="size-11 px-0"
                onClick={() => onCancel(appointment)}
                size="sm"
                variant="ghost"
              >
                <Ban aria-hidden="true" className="size-4" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
