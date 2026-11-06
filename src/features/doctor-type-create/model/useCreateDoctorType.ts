import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type DoctorType,
  type DoctorTypeFormInput,
  doctorTypeKeys,
  doctorTypeSchema,
  toDoctorType,
  toDoctorTypePayload,
} from '@/entities/doctor-type'
import { httpClient } from '@/shared/api/httpClient'

async function createDoctorType(input: DoctorTypeFormInput): Promise<DoctorType> {
  const raw = await httpClient<unknown>('v1/specialties/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toDoctorTypePayload(input)),
  })

  // The server sets `clinic` itself and answers with the list serializer.
  return toDoctorType(v.parse(doctorTypeSchema, raw))
}

/** ⛔ No optimistic update (§6.5): the server assigns the id. */
export function useCreateDoctorType(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDoctorType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorTypeKeys.scope(clinicId) })
    },
  })
}
