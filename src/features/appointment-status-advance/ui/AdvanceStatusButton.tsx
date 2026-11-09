import { useTranslation } from 'react-i18next'
import type { Appointment } from '@/entities/appointment'
import { Can } from '@/entities/session'
import { Button, toast } from '@/shared/ui'
import { nextStatusOf } from '../model/nextStatus'
import { useSetAppointmentStatus } from '../model/useSetAppointmentStatus'

export interface AdvanceStatusButtonProps {
  clinicId: string
  appointment: Pick<Appointment, 'id' | 'status' | 'fullName'>
}

/** "Arrived" for a booked visit, "Done" for one in progress; nothing once it is over. */
export function AdvanceStatusButton({ clinicId, appointment }: AdvanceStatusButtonProps) {
  const { t } = useTranslation('appointments')
  const { mutate, isPending } = useSetAppointmentStatus(clinicId)
  const next = nextStatusOf(appointment.status)
  if (next === null) return null

  const label = t(next === 'arrived' ? 'advance.arrived' : 'advance.completed')

  return (
    <Can permission="appointment:manage">
      <Button
        aria-label={`${label} — ${appointment.fullName}`}
        isLoading={isPending}
        onClick={() =>
          mutate(
            { appointmentId: appointment.id, status: next },
            { onError: () => toast.error(t('advance.failed')) },
          )
        }
        size="sm"
        variant={next === 'arrived' ? 'secondary' : 'primary'}
      >
        {label}
      </Button>
    </Can>
  )
}
