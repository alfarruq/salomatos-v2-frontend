import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ClinicSummaryCard, clinicQueries } from '@/entities/clinic'
import { Can } from '@/entities/session'
import { EditClinicForm } from '@/features/clinic-edit'
import { Card, ErrorState, QueryBoundary, Skeleton } from '@/shared/ui'

export const Route = createFileRoute('/_auth/manage/clinic')({
  component: ClinicSection,
})

function ClinicSection() {
  const { t } = useTranslation('common')
  // Set by the `_auth` guard, which resolved the session before this rendered.
  const { clinicId } = Route.useRouteContext()

  const query = useQuery(clinicQueries.mine(clinicId))

  return (
    <QueryBoundary
      error={({ retry }) => (
        <ErrorState
          description={t('error.pageBody')}
          retryLabel={t('action.retry')}
          title={t('error.pageTitle')}
          {...(retry === undefined ? {} : { onRetry: retry })}
        />
      )}
      loading={
        <Card className="flex max-w-lg flex-col gap-4 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full" />
        </Card>
      }
      query={query}
    >
      {(clinic) => (
        // The read-only card only for those who cannot edit: beside the form it
        // showed the saved hours ("closed" before the first save) next to the
        // form's defaults, two answers to one question.
        <Can fallback={<ClinicSummaryCard clinic={clinic} />} permission="clinic:manage">
          {/* Keyed by id so switching branch resets the form to that branch's profile. */}
          <EditClinicForm clinic={clinic} clinicId={clinicId} key={clinic.id} />
        </Can>
      )}
    </QueryBoundary>
  )
}
