import { queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { cachePolicy } from '@/shared/config/cache'
import { toVoiceDraft, toVoiceStatus, voiceDraftSchema, voiceStatusSchema } from '../model/schema'
import type { VoiceDraft, VoiceDraftRequest, VoiceStatus } from '../model/types'

export const voiceKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'voice'] as const,
  status: (clinicId: string) => [...voiceKeys.scope(clinicId), 'status'] as const,
}

export async function fetchVoiceStatus(signal?: AbortSignal): Promise<VoiceStatus> {
  const raw = await httpClient<unknown>('v1/voice/status/', signal === undefined ? {} : { signal })
  return toVoiceStatus(v.parse(voiceStatusSchema, raw))
}

/**
 * A POST because the dictation is PHI and must stay out of URLs and logs, not
 * because it changes anything: no record is written. Features wrap it in a
 * mutation (`retry: false` — every call is billed).
 */
export async function requestVoiceDraft(input: VoiceDraftRequest): Promise<VoiceDraft> {
  const raw = await httpClient<unknown>('v1/voice/draft/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      form: input.form,
      text: input.text,
      ...(input.patientId ? { patient: input.patientId } : {}),
    }),
  })
  return toVoiceDraft(v.parse(voiceDraftSchema, raw))
}

export const voiceQueries = {
  status: (clinicId: string) =>
    queryOptions({
      queryKey: voiceKeys.status(clinicId),
      queryFn: ({ signal }) => fetchVoiceStatus(signal),
      ...cachePolicy.standard,
    }),
}
