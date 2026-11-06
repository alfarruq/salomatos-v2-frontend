import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Administrator,
  type AdministratorFormInput,
  administratorKeys,
  administratorSchema,
  toAdministrator,
  toAdministratorPayload,
} from '@/entities/administrator'
import { httpClient } from '@/shared/api/httpClient'

async function createAdministrator(input: AdministratorFormInput): Promise<Administrator> {
  const raw = await httpClient<unknown>('v1/staff/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toAdministratorPayload(input)),
  })

  // The server assigns `role='admin'` and `clinic` itself.
  return toAdministrator(v.parse(administratorSchema, raw))
}

/** ⛔ No optimistic update (§6.5): the server assigns the id and enforces unique logins. */
export function useCreateAdministrator(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAdministrator,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: administratorKeys.scope(clinicId) })
    },
  })
}
