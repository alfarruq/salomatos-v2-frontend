import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Doctor,
  type DoctorFormInput,
  type DoctorId,
  doctorKeys,
  doctorSchema,
  toDoctor,
  toDoctorPayload,
} from '@/entities/doctor'
import { httpClient } from '@/shared/api/httpClient'

async function updateDoctor({
  doctorId,
  input,
}: {
  doctorId: DoctorId
  input: DoctorFormInput
}): Promise<Doctor> {
  const payload = toDoctorPayload(input)

  const raw = await httpClient<unknown>(`v1/staff/${doctorId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return toDoctor(v.parse(doctorSchema, raw))
}

/** ⛔ No optimistic update (§6.5): a rejected edit would leave the wrong name on screen. */
export function useUpdateDoctor(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateDoctor,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorKeys.scope(clinicId) })
    },
  })
}
