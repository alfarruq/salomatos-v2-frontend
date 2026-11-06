import { queryOptions } from '@tanstack/react-query'
import { httpBlob, httpClient } from '@/shared/api/httpClient'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import { attachmentSchema, toAttachment } from '../model/schema'
import type { Attachment } from '../model/types'

/** §6.2 — the tenant scope is inside every key, without exception. */
export const attachmentKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'attachments'] as const,
  list: (clinicId: string, patientId: string) =>
    [...attachmentKeys.scope(clinicId), 'list', patientId] as const,
  file: (clinicId: string, attachmentId: string) =>
    [...attachmentKeys.scope(clinicId), 'file', attachmentId] as const,
}

export async function fetchAttachments(
  patientId: string,
  signal?: AbortSignal,
): Promise<Attachment[]> {
  const init = signal === undefined ? {} : { signal }
  const rows = await fetchAllPages(
    `v1/attachments/?patient=${patientId}&page_size=100`,
    attachmentSchema,
    (path) => httpClient<unknown>(path, init),
  )
  return rows.map(toAttachment)
}

export function fetchAttachmentFile(attachmentId: string, signal?: AbortSignal): Promise<Blob> {
  return httpBlob(
    `v1/attachments/${attachmentId}/download/`,
    signal === undefined ? {} : { signal },
  )
}

export const attachmentQueries = {
  list: (clinicId: string, patientId: string) =>
    queryOptions({
      queryKey: attachmentKeys.list(clinicId, patientId),
      queryFn: ({ signal }) => fetchAttachments(patientId, signal),
      ...cachePolicy.standard,
    }),

  /**
   * The bytes, held in memory only (§3: no persisted query cache). A file never
   * changes once uploaded, so it is not refetched while the card is open.
   */
  file: (clinicId: string, attachmentId: string) =>
    queryOptions({
      queryKey: attachmentKeys.file(clinicId, attachmentId),
      queryFn: ({ signal }) => fetchAttachmentFile(attachmentId, signal),
      ...cachePolicy.static,
    }),
}
