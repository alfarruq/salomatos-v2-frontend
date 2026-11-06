import { type UseQueryResult, useQueries } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCan } from '@/entities/session'
import {
  defaultTreatmentListFilters,
  type Treatment,
  type TreatmentListFilters,
  TreatmentStatusBadge,
  treatmentQueries,
} from '@/entities/treatment'
import { PAGE_SIZE, type Page } from '@/shared/api/pagination'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { cn } from '@/shared/lib/cn'
import { formatSom } from '@/shared/lib/money'
import {
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  QueryBoundary,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/shared/ui'
import { PAGES_PER_SCREEN, serverPagesFor } from '../model/screenPages'
import { TreatmentFilters } from './TreatmentFilters'

export interface TreatmentTableProps {
  clinicId: string
  /** From the URL — ids and a screen number only, never a name (§3). `page` counts screens of up to 30 rows. */
  filters: TreatmentListFilters
  onFiltersChange: (filters: TreatmentListFilters) => void
}

/** Shown when the server had nothing to send for a cell. */
const EMPTY = '—'

interface ScreenData {
  count: number
  results: Treatment[]
  hasNext: boolean
}

/**
 * The screen's server pages as one query for `QueryBoundary`: pending until
 * the first page arrives, rows in page order, and stopping at the first page
 * still on its way so a later one can never show above it.
 */
function combinePages(results: UseQueryResult<Page<Treatment>>[]) {
  const loaded: Page<Treatment>[] = []
  for (const result of results) {
    if (result.data === undefined) break
    loaded.push(result.data)
  }
  const failed = results.filter((result) => result.isError)
  const last = loaded.at(-1)

  return {
    data:
      last === undefined
        ? undefined
        : ({
            count: last.count,
            results: loaded.flatMap((page) => page.results),
            hasNext: last.next !== null,
          } satisfies ScreenData),
    isPending: last === undefined && failed.length === 0,
    isError: failed.length > 0,
    error: failed[0]?.error ?? null,
    isFetching: results.some((result) => result.isFetching),
    refetch: () => {
      for (const result of failed) void result.refetch()
    },
  }
}

/**
 * Every treatment in the clinic, filtered on the server — by patient, doctor,
 * treatment type, debt and status — 10, 20, then 30 rows on the first
 * screen, and 30 at a time after that.
 */
export function TreatmentTable({ clinicId, filters, onFiltersChange }: TreatmentTableProps) {
  const { t, i18n } = useTranslation(['treatments', 'common'])
  const { page: screen } = filters
  const filterKey = JSON.stringify({ ...filters, page: null })
  const [growth, setGrowth] = useState({ filterKey, pages: 1 })
  // A different filter starts the first screen over at ten rows.
  const firstScreenPages = growth.filterKey === filterKey ? growth.pages : 1
  const loadedPages = screen === 1 ? firstScreenPages : PAGES_PER_SCREEN
  const query = useQueries({
    queries: serverPagesFor(screen, loadedPages).map((serverPage) =>
      treatmentQueries.page(clinicId, { ...filters, page: serverPage }),
    ),
    combine: combinePages,
  })
  const isFiltered =
    filters.patientId !== null ||
    filters.doctorId !== null ||
    filters.treatmentTypeId !== null ||
    filters.status !== null
  // Without `payment:view` the money column is not theirs.
  const canSeeMoney = useCan('payment:view')
  const navigate = useNavigate()

  const money = (value: number | null) =>
    value === null ? EMPTY : formatSom(value, i18n.language, t('common:currency.som'))

  const showNext = () => {
    if (screen === 1 && loadedPages < PAGES_PER_SCREEN) {
      setGrowth({ filterKey, pages: loadedPages + 1 })
    } else {
      onFiltersChange({ ...filters, page: screen + 1 })
    }
  }

  const showPrevious = () => {
    // Back on the first screen, all thirty rows — the user has already seen past them.
    if (screen === 2) setGrowth({ filterKey, pages: PAGES_PER_SCREEN })
    onFiltersChange({ ...filters, page: screen - 1 })
  }

  const openPatient = (treatment: Treatment) => {
    if (treatment.patientId === null) return
    void navigate({
      to: '/patients/$patientId',
      params: { patientId: String(treatment.patientId) },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <TreatmentFilters clinicId={clinicId} filters={filters} onFiltersChange={onFiltersChange} />

      <QueryBoundary
        empty={
          isFiltered ? (
            <EmptyState
              action={
                <Button onClick={() => onFiltersChange(defaultTreatmentListFilters)} size="sm">
                  {t('treatments:filters.clear')}
                </Button>
              }
              description={t('treatments:filters.noMatchDescription')}
              headingLevel={2}
              icon={<Stethoscope aria-hidden="true" className="size-8" />}
              title={t('treatments:filters.noMatch')}
            />
          ) : (
            <EmptyState
              description={t('treatments:list.emptyDescription')}
              headingLevel={2}
              icon={<Stethoscope aria-hidden="true" className="size-8" />}
              title={t('treatments:list.empty')}
            />
          )
        }
        error={({ retry }) => (
          <ErrorState
            description={t('common:error.pageBody')}
            retryLabel={t('common:action.retry')}
            title={t('common:error.pageTitle')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={(data) => data.results.length === 0}
        loading={
          <Table>
            <TableSkeleton columns={canSeeMoney ? 10 : 7} rows={PAGE_SIZE} />
          </Table>
        }
        query={query}
      >
        {(data) => (
          <div className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('treatments:table.columnDate')}</TableHead>
                  <TableHead>{t('treatments:list.columnPatient')}</TableHead>
                  <TableHead>{t('treatments:list.columnDoctor')}</TableHead>
                  <TableHead>{t('treatments:table.columnType')}</TableHead>
                  <TableHead align="center">{t('treatments:table.columnTooth')}</TableHead>
                  {canSeeMoney ? (
                    <TableHead align="right">{t('treatments:table.columnCost')}</TableHead>
                  ) : null}
                  <TableHead>{t('treatments:table.columnStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((treatment) => (
                  <TableRow isInteractive key={treatment.id} onClick={() => openPatient(treatment)}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatFixedDate(treatment.startDate)}
                    </TableCell>
                    <TableCell>
                      {/* The keyboard path to the patient; the row click is the mouse's. */}
                      <Link
                        className="font-medium text-text hover:underline focus-visible:underline"
                        onClick={(event) => event.stopPropagation()}
                        params={{ patientId: treatment.patientId }}
                        to="/patients/$patientId"
                      >
                        {treatment.patientName ?? EMPTY}
                      </Link>
                    </TableCell>
                    <TableCell>{treatment.doctorName ?? EMPTY}</TableCell>
                    <TableCell>{treatment.treatmentTypeName ?? EMPTY}</TableCell>
                    <TableCell align="center" className="tabular-nums">
                      {treatment.toothNumber ?? EMPTY}
                    </TableCell>
                    {canSeeMoney ? (
                      <TableCell
                        align="right"
                        className={cn(
                          'whitespace-nowrap tabular-nums',
                          // A voided line stays visible but no longer counts.
                          treatment.status === 'voided' && 'text-text-tertiary line-through',
                        )}
                      >
                        {money(treatment.totalTreatmentCost)}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <TreatmentStatusBadge status={treatment.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              hasNext={data.hasNext}
              hasPrevious={screen > 1}
              isLoading={query.isFetching}
              nextLabel={t('common:action.next')}
              onNext={showNext}
              onPrevious={showPrevious}
              previousLabel={t('common:action.previous')}
              summary={t('treatments:list.summary', {
                count: data.count,
                from: (screen - 1) * PAGES_PER_SCREEN * PAGE_SIZE + 1,
                to: (screen - 1) * PAGES_PER_SCREEN * PAGE_SIZE + data.results.length,
              })}
            />
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
