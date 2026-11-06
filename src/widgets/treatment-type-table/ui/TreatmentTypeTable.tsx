import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { doctorTypeQueries } from '@/entities/doctor-type'
import type { TreatmentType } from '@/entities/treatment-type'
import { treatmentTypeQueries } from '@/entities/treatment-type'
import { CreateTreatmentTypeDialog } from '@/features/treatment-type-create'
import { DeleteTreatmentTypeDialog } from '@/features/treatment-type-delete'
import { EditTreatmentTypeDialog } from '@/features/treatment-type-edit'
import { formatSom } from '@/shared/lib/money'
import {
  Button,
  EmptyState,
  ErrorState,
  QueryBoundary,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/shared/ui'

export interface TreatmentTypeTableProps {
  clinicId: string
}

/** Shown when the server had nothing to send for a cell. */
const EMPTY = '—'

/*
 * Radix's `Select` hardcodes `""` to mean "nothing selected, show the
 * placeholder" (`shouldShowPlaceholder` in its own source) — it is not
 * available as a real, displayable option value, unlike every other filter
 * value here. "All types" and "unassigned" need their own sentinels instead,
 * distinct from any real doctor-type name.
 */
const FILTER_ALL = 'all'
const FILTER_UNASSIGNED = 'unassigned'

/**
 * The clinic's services and prices.
 *
 * No search and no page-number controls here even though the endpoint itself
 * paginates (`fetchTreatmentTypes` follows every page) — a price list is tens
 * of rows, not thousands, and a settings screen has no use for paging through it.
 */
export function TreatmentTypeTable({ clinicId }: TreatmentTypeTableProps) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<TreatmentType | null>(null)
  const [deleting, setDeleting] = useState<TreatmentType | null>(null)
  // Filtering happens client-side (below) — the list is already whole
  // (`fetchTreatmentTypes` follows every page), and a settings screen with a
  // few dozen rows at most has no need to round-trip a filter to the server.
  const [doctorTypeFilter, setDoctorTypeFilter] = useState(FILTER_ALL)

  const query = useQuery(treatmentTypeQueries.list(clinicId))

  const doctorTypesQuery = useQuery(doctorTypeQueries.list(clinicId))
  // The price list sends only the specialty's id; the name comes from the specialty list.
  const doctorTypeNames = new Map(
    (doctorTypesQuery.data ?? []).map((doctorType) => [doctorType.id, doctorType.name]),
  )
  const doctorTypeFilterOptions = [
    { value: FILTER_ALL, label: t('admin:service.filterAll') },
    ...(doctorTypesQuery.data ?? []).map((doctorType) => ({
      value: doctorType.id,
      label: doctorType.name,
    })),
    { value: FILTER_UNASSIGNED, label: t('admin:service.filterUnassigned') },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-callout text-text-secondary">{t('admin:service.description')}</p>
        <div className="flex items-center gap-2">
          {/* Not shown — the select's own visible options already say what it
              filters. Kept for assistive tech, which still needs a name for it. */}
          <label className="sr-only" htmlFor="treatment-type-doctor-type-filter">
            {t('admin:service.filterLabel')}
          </label>
          <Select
            id="treatment-type-doctor-type-filter"
            onValueChange={setDoctorTypeFilter}
            options={doctorTypeFilterOptions}
            size="sm"
            value={doctorTypeFilter}
          />
          <Button onClick={() => setCreateOpen(true)} size="sm" variant="primary">
            {t('admin:service.create')}
          </Button>
        </div>
      </div>

      <QueryBoundary
        empty={
          <EmptyState
            action={
              <Button onClick={() => setCreateOpen(true)} variant="primary">
                {t('admin:service.create')}
              </Button>
            }
            description={t('admin:service.emptyDescription')}
            title={t('admin:service.empty')}
          />
        }
        error={({ retry }) => (
          <ErrorState
            description={t('common:error.pageBody')}
            retryLabel={t('common:action.retry')}
            title={t('common:error.pageTitle')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        loading={
          <Table density="compact">
            <TableSkeleton columns={4} rows={5} />
          </Table>
        }
        query={query}
      >
        {(allServices) => {
          const services =
            doctorTypeFilter === FILTER_ALL
              ? allServices
              : doctorTypeFilter === FILTER_UNASSIGNED
                ? allServices.filter((service) => service.doctorTypeId === null)
                : allServices.filter((service) => service.doctorTypeId === doctorTypeFilter)

          if (services.length === 0) {
            return (
              <p className="py-8 text-center text-callout text-text-secondary">
                {t('admin:service.filterEmpty')}
              </p>
            )
          }

          return (
            <Table density="compact">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin:service.name')}</TableHead>
                  <TableHead>{t('admin:service.doctorType')}</TableHead>
                  <TableHead align="right">{t('admin:service.price')}</TableHead>
                  <TableHead align="right">{t('common:action.edit')}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>{service.name}</TableCell>
                    <TableCell>
                      {(service.doctorTypeId === null
                        ? null
                        : doctorTypeNames.get(service.doctorTypeId)) ?? EMPTY}
                    </TableCell>
                    <TableCell align="right">
                      {/* No price is a real state, not a zero — some work is
                          quoted per case. */}
                      {service.price === null
                        ? t('admin:service.noPrice')
                        : formatSom(service.price, i18n.language, t('common:currency.som'))}
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label={`${t('common:action.edit')} — ${service.name}`}
                          onClick={() => setEditing(service)}
                          size="sm"
                          variant="ghost"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          aria-label={`${t('common:action.delete')} — ${service.name}`}
                          onClick={() => setDeleting(service)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        }}
      </QueryBoundary>

      <CreateTreatmentTypeDialog
        clinicId={clinicId}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />

      {editing === null ? null : (
        <EditTreatmentTypeDialog
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          open
          service={editing}
        />
      )}

      {deleting === null ? null : (
        <DeleteTreatmentTypeDialog
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          open
          service={deleting}
        />
      )}
    </div>
  )
}
