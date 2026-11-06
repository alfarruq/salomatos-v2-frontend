import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type Appointment, AppointmentStatusBadge } from '@/entities/appointment'
import { cn } from '@/shared/lib/cn'

export interface TodayQueueProps {
  queue: readonly Appointment[]
  nextId: string | null
}

/** time | patient (+ doctor on a phone) | doctor | status */
const rowGrid =
  'grid grid-cols-[3rem_1fr_auto] items-center gap-3 sm:grid-cols-[3.5rem_1fr_12rem_auto]'

/**
 * Today's appointments, earliest first. Each row is a real link to the
 * patient, so Enter, focus and middle-click all work without extra code; a
 * walk-in with no patient record yet has nowhere to go and is plain text.
 */
export function TodayQueue({ queue, nextId }: TodayQueueProps) {
  const { t } = useTranslation('dashboard')

  return (
    <div className="flex flex-col">
      <div
        aria-hidden="true"
        className={cn(
          rowGrid,
          'border-b border-border px-3 pb-2 text-caption text-text-tertiary max-sm:hidden',
        )}
      >
        <span>{t('queue.time')}</span>
        <span>{t('queue.patient')}</span>
        <span className="hidden sm:block">{t('queue.doctor')}</span>
        <span>{t('queue.status')}</span>
      </div>

      <ul aria-label={t('queue.title')} className="flex flex-col">
        {queue.map((appointment) => (
          <li className="border-b border-border last:border-b-0" key={appointment.id}>
            <QueueRow appointment={appointment} isNext={appointment.id === nextId} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function QueueRow({ appointment, isNext }: { appointment: Appointment; isNext: boolean }) {
  const { t } = useTranslation('dashboard')
  const doctor = appointment.doctorName ?? '—'

  const content: ReactNode = (
    <>
      <span className="text-callout font-medium text-text tabular-nums max-sm:text-body max-sm:font-semibold">
        {appointment.time}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-callout text-text">{appointment.fullName}</span>
        <span className="truncate text-caption text-text-secondary sm:hidden">{doctor}</span>
      </span>
      <span className="hidden truncate text-callout text-text-secondary sm:block">{doctor}</span>
      <span className="flex items-center justify-end gap-2">
        {/* Spelled out, not only coloured: the highlight must survive a screen reader. */}
        {isNext ? (
          <span className="text-caption font-medium text-accent-text">{t('queue.next')}</span>
        ) : null}
        <AppointmentStatusBadge status={appointment.status} />
      </span>
    </>
  )

  const className = cn(
    rowGrid,
    'min-h-11 rounded-control border-l-4 border-transparent px-3 py-2 max-sm:min-h-16',
    isNext && 'border-accent bg-accent-soft',
  )

  if (appointment.patientId === null) {
    return (
      <div className={className} data-next={isNext || undefined}>
        {content}
      </div>
    )
  }

  return (
    <Link
      className={cn(
        className,
        'outline-none transition-colors duration-150 ease-out-apple hover:bg-sunken',
        'focus-visible:ring-2 focus-visible:ring-accent',
      )}
      data-next={isNext || undefined}
      params={{ patientId: String(appointment.patientId) }}
      to="/patients/$patientId"
    >
      {content}
    </Link>
  )
}
