import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Clinic,
  type ClinicFormInput,
  clinicKeys,
  clinicSchema,
  toClinic,
  toClinicPayload,
} from '@/entities/clinic'
import { httpClient } from '@/shared/api/httpClient'

/** The branch is the one in `X-Clinic-Id`; the body never names it. */
async function updateClinic(input: ClinicFormInput): Promise<Clinic> {
  const raw = await httpClient<unknown>('v1/clinic/', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toClinicPayload(input)),
  })
  return toClinic(v.parse(clinicSchema, raw))
}

/** ⛔ No optimistic update (§6.5): the profile prints on prescriptions. */
export function useUpdateClinic(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateClinic,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clinicKeys.scope(clinicId) })
    },
  })
}
