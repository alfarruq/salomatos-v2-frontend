import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import { Archive, Users, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultPatientFilters, patientQueries } from '@/entities/patient'
import { paymentQueries } from '@/entities/payment'
import { useCan } from '@/entities/session'
import type { Page } from '@/shared/api/pagination'
import { Card, Skeleton } from '@/shared/ui'

/**
 * Three counts above the patient list.
 *
 * Every figure is the `count` of a first page the list endpoints already
 * serve, so no stats endpoint is needed. The active count shares its cache
 * entry with the table's own first page.
 */
export function PatientSummary({ clinicId }: { clinicId: string }) {
  const { t } = useTranslation('patients')
  const canSeeMoney = useCan('payment:view')

  const total = useQuery(patientQueries.list(clinicId, defaultPatientFilters))
  const archived = useQuery(
    patientQueries.list(clinicId, { ...defaultPatientFilters, archived: true }),
  )
  // A doctor without billing rights would only get a 403 for this one.
  const debtors = useQuery({
    ...paymentQueries.debtors(clinicId, { page: 1 }),
    enabled: canSeeMoney,
  })

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <SummaryTile icon={<Users className="size-5" />} label={t('summary.total')} query={total} />
      <SummaryTile
        icon={<Archive className="size-5" />}
        label={t('summary.archived')}
        query={archived}
      />
      {canSeeMoney ? (
        <SummaryTile
          icon={<Wallet className="size-5" />}
          label={t('summary.debtors')}
          query={debtors}
        />
      ) : null}
    </dl>
  )
}

function SummaryTile({
  icon,
  label,
  query,
}: {
  icon: ReactNode
  label: string
  query: UseQueryResult<Page<unknown>>
}) {
  const { i18n } = useTranslation()

  return (
    <Card className="flex items-center gap-3 p-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <dt className="text-caption text-text-secondary">{label}</dt>
        <dd className="text-title2 text-text tabular-nums">
          {query.isPending ? (
            <Skeleton className="my-1 h-6 w-12" />
          ) : query.isError ? (
            // A tile is a convenience; the table below carries its own error state.
            '—'
          ) : (
            new Intl.NumberFormat(i18n.language).format(query.data.count)
          )}
        </dd>
      </div>
    </Card>
  )
}
