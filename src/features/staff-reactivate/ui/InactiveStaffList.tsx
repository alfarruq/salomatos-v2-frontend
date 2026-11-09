import { useTranslation } from 'react-i18next'
import { ReactivateStaffButton } from './ReactivateStaffButton'

export interface InactiveStaffListProps {
  clinicId: string
  staff: readonly { id: string; fullName: string }[]
}

/**
 * Deactivated staff under the active table, so a doctor or admin removed by
 * mistake (or back from leave) can be brought back with their history intact.
 */
export function InactiveStaffList({ clinicId, staff }: InactiveStaffListProps) {
  const { t } = useTranslation('admin')
  if (staff.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-callout font-medium text-text-secondary">
        {t('staff.inactiveTitle', { count: staff.length })}
      </h3>
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
        {staff.map((member) => (
          <li
            className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
            key={member.id}
          >
            <span className="truncate text-callout text-text-secondary">{member.fullName}</span>
            <ReactivateStaffButton clinicId={clinicId} staff={member} />
          </li>
        ))}
      </ul>
    </section>
  )
}
