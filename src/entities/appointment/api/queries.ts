import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { fetchAllPages, type Page } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import { weekDatesOf } from '@/shared/lib/calendarDate'
import { clinicInstantOf } from '@/shared/lib/datetime'
import { appointmentPageSchema, appointmentSchema, toAppointment } from '../model/schema'
import type { Appointment, AppointmentFilters } from '../model/types'

/** §6.2 — `clinicId` is inside every key, without exception. */
export const appointmentKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'appointments'] as const,
  list: (clinicId: string, filters: AppointmentFilters) =>
    [...appointmentKeys.scope(clinicId), 'list', filters] as const,
  page: (clinicId: string, filters: AppointmentFilters, page: number) =>
    [...appointmentKeys.scope(clinicId), 'page', filters, page] as const,
}

/**
 * The day or week becomes a `start_from`/`start_to` range of instants, computed
 * on the clinic's clock: a 02:00 Tashkent visit belongs to a day UTC still
 * calls yesterday.
 */
function toQueryString(filters: AppointmentFilters, page = 1): string {
  const params = new URLSearchParams()
  if (filters.view !== 'all') {
    const days = filters.view === 'week' ? weekDatesOf(filters.date) : [filters.date]
    const first = days[0] ?? filters.date
    const last = days[days.length - 1] ?? filters.date
    params.set('start_from', clinicInstantOf(first, '00:00'))
    params.set('start_to', clinicInstantOf(nextCalendarDay(last), '00:00'))
  }
  if (filters.doctorId !== undefined) params.set('doctor', filters.doctorId)
  if (filters.patientId !== undefined) params.set('patient', filters.patientId)
  if (page > 1) params.set('page', String(page))
  return `?${params.toString()}`
}

function nextCalendarDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1)).toISOString().slice(0, 10)
}

/** Every appointment in the range, across pages, oldest first. */
export async function fetchAppointments(
  filters: AppointmentFilters,
  signal?: AbortSignal,
): Promise<Appointment[]> {
  const init = signal === undefined ? {} : { signal }
  const rows = await fetchAllPages(
    `v1/appointments/${toQueryString(filters)}&page_size=100`,
    appointmentSchema,
    (path) => httpClient<unknown>(path, init),
  )
  return rows.map(toAppointment)
}

export async function fetchAppointmentPage(
  filters: AppointmentFilters,
  page: number,
  signal?: AbortSignal,
): Promise<Page<Appointment>> {
  const raw: unknown = await httpClient<unknown>(
    `v1/appointments/${toQueryString(filters, page)}`,
    signal === undefined ? {} : { signal },
  )
  const { results, ...rest } = v.parse(appointmentPageSchema, raw)
  return { ...rest, results: results.map(toAppointment) }
}

export const appointmentQueries = {
  list: (clinicId: string, filters: AppointmentFilters) =>
    queryOptions({
      queryKey: appointmentKeys.list(clinicId, filters),
      queryFn: ({ signal }) => fetchAppointments(filters, signal),
      // `live` (§6.3) — today's schedule, exactly what that policy exists for.
      ...cachePolicy.live,
    }),

  page: (clinicId: string, filters: AppointmentFilters, page: number) =>
    queryOptions({
      queryKey: appointmentKeys.page(clinicId, filters, page),
      queryFn: ({ signal }) => fetchAppointmentPage(filters, page, signal),
      ...cachePolicy.live,
      // Paging keeps the current page on screen instead of flashing a skeleton.
      placeholderData: keepPreviousData,
    }),
}
