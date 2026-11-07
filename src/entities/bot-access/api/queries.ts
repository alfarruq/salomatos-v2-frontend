import { queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { cachePolicy } from '@/shared/config/cache'
import { botAccessSchema, toBotAccess } from '../model/schema'
import type { BotAccess, BotAccessTarget } from '../model/types'

export const botAccessKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'bot-access'] as const,
  detail: (clinicId: string, target: BotAccessTarget) =>
    [
      ...botAccessKeys.scope(clinicId),
      target.kind,
      target.kind === 'mine' ? null : target.id,
    ] as const,
}

export function botAccessPath(target: BotAccessTarget): string {
  switch (target.kind) {
    case 'patient':
      return `v1/patients/${target.id}/bot-access/`
    case 'staff':
      return `v1/staff/${target.id}/bot-access/`
    case 'mine':
      return 'v1/me/bot-access/'
  }
}

export async function fetchBotAccess(
  target: BotAccessTarget,
  signal?: AbortSignal,
): Promise<BotAccess> {
  const raw = await httpClient<unknown>(
    botAccessPath(target),
    signal === undefined ? {} : { signal },
  )
  return toBotAccess(v.parse(botAccessSchema, raw))
}

export const botAccessQueries = {
  // A password is a credential: never kept once the screen that showed it is gone.
  detail: (clinicId: string, target: BotAccessTarget) =>
    queryOptions({
      queryKey: botAccessKeys.detail(clinicId, target),
      queryFn: ({ signal }) => fetchBotAccess(target, signal),
      ...cachePolicy.never,
    }),
}
