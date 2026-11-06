import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type DoctorType,
  type DoctorTypeFormInput,
  type DoctorTypeId,
  doctorTypeKeys,
  doctorTypeSchema,
  toDoctorType,
  toDoctorTypePayload,
} from '@/entities/doctor-type'
import { httpClient } from '@/shared/api/httpClient'

/**
 * ⚠️ `update_doctor_type` calls `get_doctor_type(id)` with no tenant argument,
 * so the server will edit another clinic's doctor type if given the id — the
 * same IDOR pattern as doctors and treatment types (item 3 in the backend
 * review). Not something the client can close.
 */
async function updateDoctorType({
  doctorTypeId,
  input,
}: {
  doctorTypeId: DoctorTypeId
  input: DoctorTypeFormInput
}): Promise<DoctorType> {
  const raw = await httpClient<unknown>(`v1/specialties/${doctorTypeId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toDoctorTypePayload(input)),
  })

  return toDoctorType(v.parse(doctorTypeSchema, raw))
}

/** ⛔ No optimistic update (§6.5): a rejected rename would leave the wrong name on screen. */
export function useUpdateDoctorType(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateDoctorType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorTypeKeys.scope(clinicId) })
    },
  })
}
