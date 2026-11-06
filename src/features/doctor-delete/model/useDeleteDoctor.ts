import { useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentKeys } from '@/entities/appointment'
import { type DoctorId, doctorKeys } from '@/entities/doctor'
import { patientKeys } from '@/entities/patient'
import { treatmentKeys } from '@/entities/treatment'
import { httpClient } from '@/shared/api/httpClient'

async function deleteDoctor(doctorId: DoctorId): Promise<void> {
  await httpClient<void>(`v1/staff/${doctorId}/`, { method: 'DELETE' })
}

/** ⛔ No optimistic update (§6.5): a refused delete should not vanish the record first. */
export function useDeleteDoctor(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDoctor,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorKeys.scope(clinicId) })
      // Appointments, patients and treatments carry the doctor's name and may
      // be removed along with the doctor, so none of their cached copies can
      // be trusted after this.
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.scope(clinicId) })
      void queryClient.invalidateQueries({ queryKey: patientKeys.scope(clinicId) })
      void queryClient.invalidateQueries({ queryKey: treatmentKeys.scope(clinicId) })
    },
  })
}
