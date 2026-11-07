import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type BotAccess,
  type BotAccessTarget,
  botAccessKeys,
  botAccessPath,
  botAccessSchema,
  toBotAccess,
} from '@/entities/bot-access'
import { httpClient } from '@/shared/api/httpClient'

type ResettableTarget = Exclude<BotAccessTarget, { kind: 'mine' }>

async function resetBotAccess(target: ResettableTarget): Promise<BotAccess> {
  const raw = await httpClient<unknown>(`${botAccessPath(target)}reset/`, { method: 'POST' })
  return toBotAccess(v.parse(botAccessSchema, raw))
}

/** ⛔ No optimistic update: the new password only exists once the server made it. */
export function useResetBotAccess(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetBotAccess,
    retry: false,
    onSuccess: (access, target) => {
      queryClient.setQueryData(botAccessKeys.detail(clinicId, target), access)
    },
  })
}
