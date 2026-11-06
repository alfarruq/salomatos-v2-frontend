import type { Appointment } from '@/entities/appointment'

export interface TodayCounts {
  total: number
  completed: number
  /** Not yet completed — the only other status an appointment has. */
  remaining: number
}

/**
 * Today's queue for whoever is looking: only `date`'s rows, only `doctorId`'s
 * when one is given, earliest first.
 *
 * The date check repeats what `?date=day` already asked the server for, on
 * purpose: that shortcut is the server's "today", in its own zone, and a row
 * from another day must not be counted as one of ours.
 */
export function todaysQueue(
  appointments: readonly Appointment[],
  { date, doctorId }: { date: string; doctorId: string | null },
): Appointment[] {
  return appointments
    .filter((appointment) => appointment.date === date)
    .filter((appointment) => doctorId === null || appointment.doctorId === doctorId)
    .sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))
}

export function countToday(queue: readonly Appointment[]): TodayCounts {
  const completed = queue.filter((appointment) => appointment.status === 'completed').length
  return { total: queue.length, completed, remaining: queue.length - completed }
}

/**
 * The first not-yet-completed appointment at or after `nowTime` (`HH:mm`,
 * clinic time). One already past its slot but still open is not "next" —
 * it is late, and the list's own status column already says so.
 */
export function findNextAppointment(
  queue: readonly Appointment[],
  nowTime: string,
): Appointment | null {
  return (
    queue.find(
      (appointment) => appointment.status !== 'completed' && appointment.time >= nowTime,
    ) ?? null
  )
}
