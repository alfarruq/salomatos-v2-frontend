import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  type Appointment,
  AppointmentStatusBadge,
  isClosedAppointmentStatus,
} from '@/entities/appointment'
import { doctorColorOf } from '@/entities/doctor'
import { type CalendarDate, todayCalendarDate } from '@/shared/lib/calendarDate'
import { cn } from '@/shared/lib/cn'
import { Button, DropdownMenu, DropdownMenuItem, Skeleton } from '@/shared/ui'
import { weekDatesOf } from '../model/dateNav'

export interface AppointmentWeekBoardProps {
  appointments: Appointment[]
  /** The week shown is Monday–Sunday of the week containing this date. */
  referenceDate: CalendarDate
  onOpen: (appointment: Appointment) => void
  onEdit: (appointment: Appointment) => void
  onCancel: (appointment: Appointment) => void
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** Shown when a card has nothing to say beyond the name. */
const EMPTY = '—'

/**
 * Monday–Sunday as seven day columns, each a stack of cards rather than table
 * rows — matches the reference layout the person asked to copy. Client-side
 * grouping by `appointment.date`: whatever the week endpoint sends, only rows
 * that actually land in this Monday–Sunday range get a column to sit in.
 *
 * Only rendered from `md` up — a phone is always shown one day — and always
 * under `AppointmentWeekHeader`, whose arrow gutters `px-16` leaves room for.
 */
export function AppointmentWeekBoard({
  appointments,
  referenceDate,
  onOpen,
  onEdit,
  onCancel,
}: AppointmentWeekBoardProps) {
  const { t } = useTranslation(['appointments', 'common'])
  const dates = weekDatesOf(referenceDate)

  return (
    <div className="grid grid-cols-7 gap-3 px-16">
      {dates.map((date) => {
        const dayAppointments = appointments
          .filter((appointment) => appointment.date === date)
          .sort((a, b) => a.time.localeCompare(b.time))

        return (
          <div className="flex flex-col gap-2" key={date}>
            <div className="flex flex-col gap-2">
              {dayAppointments.map((appointment) => {
                const color = doctorColorOf(appointment.doctorId)
                const isClosed = isClosedAppointmentStatus(appointment.status)
                return (
                  <div
                    className={cn(
                      'flex flex-col gap-1 rounded-card border border-border p-3',
                      // Open visits stand out; finished, missed and cancelled ones recede.
                      isClosed ? 'bg-sunken' : 'bg-success/10',
                    )}
                    key={appointment.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-callout font-semibold text-accent-text',
                          appointment.status === 'cancelled' && 'text-text-tertiary line-through',
                        )}
                      >
                        {appointment.time}
                      </span>
                      <DropdownMenu
                        trigger={
                          <button
                            aria-label={`${t('common:action.edit')} — ${appointment.fullName}`}
                            className="rounded-control p-1 text-text-secondary hover:bg-sunken hover:text-text"
                            type="button"
                          >
                            <MoreVertical aria-hidden="true" className="size-4" />
                          </button>
                        }
                      >
                        <DropdownMenuItem onSelect={() => onEdit(appointment)}>
                          {t('common:action.edit')}
                        </DropdownMenuItem>
                        {isClosed ? null : (
                          <DropdownMenuItem onSelect={() => onCancel(appointment)}>
                            {t('appointments:cancel.confirm')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenu>
                    </div>
                    <div className="flex">
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                    <button
                      className="flex min-w-0 flex-col gap-1 rounded-control text-left hover:underline focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => onOpen(appointment)}
                      type="button"
                    >
                      <span className="truncate text-body font-medium text-text">
                        {appointment.fullName}
                      </span>
                      <span className="flex min-w-0 items-center gap-1 text-caption text-text-secondary">
                        {appointment.doctorName === null ? null : (
                          <span
                            aria-hidden="true"
                            className={cn('size-2 shrink-0 rounded-full', color.dot)}
                          />
                        )}
                        <span className="truncate">
                          {[appointment.doctorName, appointment.treatmentTypeName]
                            .filter((value): value is string => value !== null)
                            .join(' · ') || EMPTY}
                        </span>
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export interface AppointmentWeekHeaderProps {
  /** The week shown is Monday–Sunday of the week containing this date. */
  referenceDate: CalendarDate
  onPreviousWeek: () => void
  onNextWeek: () => void
}

/**
 * The weekday row with the week's previous/next arrows at either end. Kept
 * apart from the board so the arrows stay on screen while a week is loading,
 * empty or filtered down to nothing — otherwise there would be no way out of
 * an empty week.
 */
export function AppointmentWeekHeader({
  referenceDate,
  onPreviousWeek,
  onNextWeek,
}: AppointmentWeekHeaderProps) {
  const { t } = useTranslation('appointments')
  const dates = weekDatesOf(referenceDate)
  const today = todayCalendarDate()

  return (
    // size-12 arrows + gap-4 = the board's px-16, so day columns line up.
    <div className="flex items-center gap-4">
      <Button
        aria-label={t('view.previousWeek')}
        className="size-12 shrink-0 px-0"
        onClick={onPreviousWeek}
        size="sm"
        variant="ghost"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Button>

      <div className="grid flex-1 grid-cols-7 gap-3">
        {dates.map((date, index) => (
          <div className="flex flex-col items-center gap-1 pb-1" key={date}>
            <span className="text-caption text-text-secondary">
              {t(`weekday.${WEEKDAY_KEYS[index]}`)}
            </span>
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-full text-callout font-semibold',
                date === today ? 'bg-accent text-on-accent' : 'text-text',
              )}
            >
              {Number(date.slice(-2))}
            </span>
          </div>
        ))}
      </div>

      <Button
        aria-label={t('view.nextWeek')}
        className="size-12 shrink-0 px-0"
        onClick={onNextWeek}
        size="sm"
        variant="ghost"
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </Button>
    </div>
  )
}

/** Matches `AppointmentWeekBoard`'s column layout, not a generic table skeleton. */
export function AppointmentWeekBoardSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-3 px-16">
      {Array.from({ length: 7 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity and never reorder
        <div className="flex flex-col gap-2" key={`weekday-skeleton-${index}`}>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}
