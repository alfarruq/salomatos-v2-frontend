import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Administrator,
  type AdministratorFormInput,
  type AdministratorId,
  administratorKeys,
  administratorSchema,
  toAdministrator,
  toAdministratorUpdatePayload,
} from '@/entities/administrator'
import { httpClient } from '@/shared/api/httpClient'

async function updateAdministrator({
  administratorId,
  input,
}: {
  administratorId: AdministratorId
  input: AdministratorFormInput
}): Promise<Administrator> {
  const raw = await httpClient<unknown>(`v1/staff/${administratorId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toAdministratorUpdatePayload(input)),
  })
  return toAdministrator(v.parse(administratorSchema, raw))
}

/** No optimistic update: the server enforces unique logins and signs the admin out on a new password. */
export function useUpdateAdministrator(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateAdministrator,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: administratorKeys.scope(clinicId) })
    },
  })
}
