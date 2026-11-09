import { addDays, addMonths, eachDayOfInterval, endOfMonth, startOfMonth } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  type CalendarDate,
  formatFixedDate,
  isSameCalendarDay,
  parseCalendarDate,
  toCalendarDate,
} from '@/shared/lib/calendarDate'
import { cn } from '@/shared/lib/cn'
import { dateFormat } from '@/shared/lib/dateFormat'
import { useFieldControl } from './Field'
import { Popover } from './Popover'

export interface DatePickerProps {
  /** `yyyy-MM-dd`. A calendar date — see calendarDate.ts on why not a Date. */
  value?: CalendarDate
  onChange?: (value: CalendarDate) => void
  /** Inclusive bounds, same format. */
  min?: CalendarDate
  max?: CalendarDate
  /** BCP-47 tag. Month and weekday names come from Intl, never a hardcoded list. */
  locale?: string
  placeholder: string
  /** Accessible names for the month arrows — this layer holds no copy. */
  previousMonthLabel: string
  nextMonthLabel: string
  disabled?: boolean
  id?: string
  className?: string
}

/** Monday. Uzbekistan, like most of the world outside the US, starts there. */
const WEEK_START = 1

function startOfWeekMonday(date: Date): Date {
  const offset = (date.getDay() - WEEK_START + 7) % 7
  return addDays(date, -offset)
}

function clamp(date: Date, min: Date | null, max: Date | null): boolean {
  if (min && date < min && !isSameCalendarDay(date, min)) return false
  if (max && date > max && !isSameCalendarDay(date, max)) return false
  return true
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  locale = 'uz',
  placeholder,
  previousMonthLabel,
  nextMonthLabel,
  disabled,
  id,
  className,
}: DatePickerProps) {
  const field = useFieldControl()
  const selected = value === undefined ? null : parseCalendarDate(value)
  const minDate = min === undefined ? null : parseCalendarDate(min)
  const maxDate = max === undefined ? null : parseCalendarDate(max)

  const [isOpen, setIsOpen] = useState(false)
  // The day the keyboard is on, which is not necessarily the selected one.
  const [focusedDate, setFocusedDate] = useState<Date>(selected ?? new Date())
  const gridRef = useRef<HTMLTableElement>(null)

  // The cursor position as a plain string, so the effect below depends on the
  // day itself rather than on a Date identity that changes every render.
  const activeKey = toCalendarDate(focusedDate)

  const focusActiveDay = useCallback((key: string) => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)?.focus()
  }, [])

  /*
   * Roving tabindex: exactly one day is focusable, and it takes focus whenever
   * the cursor moves. Synchronous, before paint — deferring it by a frame would
   * let a fast Enter land on the day the cursor just left.
   *
   * Focus on *open* is handled by onOpenAutoFocus below rather than here.
   * Racing Radix's own focus call produced a genuinely flaky grid.
   */
  useLayoutEffect(() => {
    if (isOpen) focusActiveDay(activeKey)
  }, [isOpen, activeKey, focusActiveDay])

  const monthStart = startOfMonth(focusedDate)
  const days = eachDayOfInterval({
    start: startOfWeekMonday(monthStart),
    end: addDays(startOfWeekMonday(endOfMonth(focusedDate)), 6),
  })

  const monthLabel = dateFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(monthStart)

  const weekdayFormatter = dateFormat(locale, { weekday: 'short' })
  const weekdays = days.slice(0, 7).map((day) => weekdayFormatter.format(day))

  // Focus follows via the layout effect above, once the new day is in the DOM.
  const moveFocus = setFocusedDate

  const select = (day: Date) => {
    onChange?.(toCalendarDate(day))
    setIsOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }

    const dayDelta = moves[event.key]
    if (dayDelta !== undefined) {
      event.preventDefault()
      moveFocus(addDays(focusedDate, dayDelta))
      return
    }

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      moveFocus(addMonths(focusedDate, event.key === 'PageUp' ? -1 : 1))
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const weekStart = startOfWeekMonday(focusedDate)
      moveFocus(event.key === 'Home' ? weekStart : addDays(weekStart, 6))
    }
  }

  // `dd.MM.yyyy` — the same day.month.year shape the placeholder shows, so
  // an empty field and a filled one read alike.
  const triggerLabel = selected && value !== undefined ? formatFixedDate(value) : placeholder

  return (
    <Popover
      align="start"
      onOpenAutoFocus={(event) => {
        // Radix would focus the panel itself, leaving keydown to fire on an
        // ancestor of the grid where the handler never sees it.
        event.preventDefault()
        focusActiveDay(activeKey)
      }}
      onOpenChange={setIsOpen}
      open={isOpen}
      trigger={
        <button
          id={id ?? field?.controlId}
          type="button"
          disabled={disabled}
          aria-describedby={field?.describedBy}
          aria-invalid={field?.isInvalid ?? undefined}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 px-4',
            'rounded-control border border-border bg-sunken text-body',
            selected ? 'text-text' : 'text-text-secondary',
            'transition-[border-color] duration-150 ease-out-apple',
            'hover:border-border-strong',
            'disabled:pointer-events-none disabled:opacity-40',
            'aria-invalid:border-danger',
            className,
          )}
        >
          {triggerLabel}
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
        </button>
      }
    >
      <div className="flex w-72 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <button
            aria-label={previousMonthLabel}
            className="flex size-8 items-center justify-center rounded-control text-text-secondary hover:bg-sunken hover:text-text"
            onClick={() => setFocusedDate(addMonths(focusedDate, -1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>

          {/* Announced when the month changes, so an arrow press is not silent. */}
          <span aria-live="polite" className="text-callout font-medium text-text">
            {monthLabel}
          </span>

          <button
            aria-label={nextMonthLabel}
            className="flex size-8 items-center justify-center rounded-control text-text-secondary hover:bg-sunken hover:text-text"
            onClick={() => setFocusedDate(addMonths(focusedDate, 1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/*
         * A real table rather than divs with grid/row/gridcell roles: the
         * semantics come for free and correctly, and the linter does not have
         * to be argued with about focusability.
         */}
        <table
          aria-label={monthLabel}
          className="w-full border-collapse"
          onKeyDown={handleKeyDown}
          ref={gridRef}
        >
          <thead>
            <tr>
              {weekdays.map((weekday) => (
                <th
                  className="py-1 text-center text-caption font-normal text-text-tertiary"
                  key={weekday}
                  scope="col"
                >
                  {weekday}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: days.length / 7 }, (_, weekIndex) => (
              <tr key={toCalendarDate(days[weekIndex * 7] as Date)}>
                {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => {
                  const dayKey = toCalendarDate(day)
                  const isOutside = day.getMonth() !== monthStart.getMonth()
                  const isSelected = selected !== null && isSameCalendarDay(day, selected)
                  const isAllowed = clamp(day, minDate, maxDate)
                  const isToday = isSameCalendarDay(day, new Date())

                  return (
                    <td className="p-0 text-center" key={dayKey}>
                      <button
                        aria-current={isToday ? 'date' : undefined}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex size-9 items-center justify-center rounded-control',
                          'text-callout transition-colors duration-150 ease-out-apple',
                          isOutside ? 'text-text-tertiary' : 'text-text',
                          isSelected && 'bg-accent text-on-accent',
                          !isSelected && isAllowed && 'hover:bg-sunken',
                          // A ring rather than a fill, so today does not compete
                          // with the selected day.
                          isToday && !isSelected && 'ring-1 ring-accent ring-inset',
                          !isAllowed && 'pointer-events-none opacity-30',
                        )}
                        data-day={dayKey}
                        disabled={!isAllowed}
                        onClick={() => select(day)}
                        tabIndex={dayKey === activeKey ? 0 : -1}
                        type="button"
                      >
                        {day.getDate()}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Popover>
  )
}
