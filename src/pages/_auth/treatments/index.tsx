import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import { Can } from '@/entities/session'
import type { TreatmentListFilters } from '@/entities/treatment'
import { TreatmentComposer } from '@/features/treatment-composer'
import { Button } from '@/shared/ui'
import { TreatmentTable } from '@/widgets/treatment-table'

const uuid = v.optional(v.pipe(v.string(), v.uuid()))
const day = v.optional(v.pipe(v.string(), v.isoDate()))

/**
 * Shareable view state (§3): UUIDs, a page and a status — never a name.
 * `?patient=<uuid>` identifies a record; `?patient=Aliyev` would disclose one.
 */
const treatmentsSearchSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  patient: uuid,
  doctor: uuid,
  type: uuid,
  status: v.optional(v.picklist(['done', 'inProgress', 'voided'])),
  from: day,
  to: day,
})

type TreatmentsSearch = v.InferOutput<typeof treatmentsSearchSchema>

export const Route = createFileRoute('/_auth/treatments/')({
  // A hand-edited URL falls back to the unfiltered first page rather than an error.
  validateSearch: (search): TreatmentsSearch => {
    const result = v.safeParse(treatmentsSearchSchema, search)
    return result.success ? result.output : {}
  },
  component: TreatmentsPage,
})

function TreatmentsPage() {
  const { t } = useTranslation('treatments')
  const { clinicId } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [isComposerOpen, setComposerOpen] = useState(false)
  // A fresh key per opening, so the dialog never reopens on the last patient's rows.
  const [composerSession, setComposerSession] = useState(0)

  const filters: TreatmentListFilters = {
    page: search.page ?? 1,
    patientId: search.patient ?? null,
    doctorId: search.doctor ?? null,
    treatmentTypeId: search.type ?? null,
    status: search.status ?? null,
    dateFrom: search.from ?? null,
    dateTo: search.to ?? null,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title1 text-text">{t('list.title')}</h1>
        {/* UX only — Django decides who may actually write a treatment (§9.1). */}
        <Can permission="procedure:manage">
          <Button
            iconLeft={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => {
              setComposerSession((session) => session + 1)
              setComposerOpen(true)
            }}
            size="sm"
            variant="primary"
          >
            {t('list.add')}
          </Button>
        </Can>
      </div>

      <TreatmentComposer
        clinicId={clinicId}
        key={composerSession}
        onOpenChange={setComposerOpen}
        open={isComposerOpen}
      />

      <TreatmentTable
        clinicId={clinicId}
        filters={filters}
        onFiltersChange={(next) =>
          void navigate({
            // Defaults stay out of the URL, so `/treatments` is the canonical unfiltered first page.
            search: (): TreatmentsSearch => ({
              ...(next.page === 1 ? {} : { page: next.page }),
              ...(next.patientId === null ? {} : { patient: next.patientId }),
              ...(next.doctorId === null ? {} : { doctor: next.doctorId }),
              ...(next.treatmentTypeId === null ? {} : { type: next.treatmentTypeId }),
              ...(next.status === null ? {} : { status: next.status }),
              ...(next.dateFrom === null ? {} : { from: next.dateFrom }),
              ...(next.dateTo === null ? {} : { to: next.dateTo }),
            }),
            to: '/treatments',
          })
        }
      />
    </div>
  )
}
