import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { paymentQueries } from '@/entities/payment'
import { PAGE_SIZE } from '@/shared/api/pagination'
import { formatSom } from '@/shared/lib/money'
import {
  Card,
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

export interface DebtorTableProps {
  clinicId: string
  page: number
  onPageChange: (page: number) => void
  /** "All branches": a branch column tells the owner where each debt sits. */
  showBranch: boolean
}

/**
 * Patients who owe the clinic, largest first. ⚠️ PHI on screen: names next to
 * money. Only the page number and a patient's UUID ever reach the URL (§3).
 */
export function DebtorTable({ clinicId, page, onPageChange, showBranch }: DebtorTableProps) {
  const { t, i18n } = useTranslation(['finance', 'common'])
  const navigate = useNavigate()
  const query = useQuery(paymentQueries.debtors(clinicId, { page }))
  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))
  const columns = showBranch ? 6 : 5

  return (
    <Card>
      <QueryBoundary
        empty={<EmptyState title={t('finance:debtors.empty')} />}
        error={({ retry }) => (
          <ErrorState
            description={t('common:error.pageBody')}
            title={t('common:error.pageTitle')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={(data) => data.results.length === 0}
        loading={
          <Table>
            <TableSkeleton columns={columns} rows={8} />
          </Table>
        }
        query={query}
      >
        {(data) => (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('finance:debtors.patient')}</TableHead>
                    <TableHead className="max-sm:hidden">{t('finance:debtors.phone')}</TableHead>
                    {showBranch ? <TableHead>{t('finance:debtors.branch')}</TableHead> : null}
                    <TableHead align="right" className="max-sm:hidden">
                      {t('finance:debtors.charged')}
                    </TableHead>
                    <TableHead align="right" className="max-sm:hidden">
                      {t('finance:debtors.paid')}
                    </TableHead>
                    <TableHead align="right">{t('finance:debtors.debt')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.results.map((debtor) => (
                    <TableRow
                      isInteractive
                      key={debtor.patientId}
                      onClick={() =>
                        void navigate({
                          to: '/patients/$patientId',
                          params: { patientId: debtor.patientId },
                        })
                      }
                    >
                      <TableCell>
                        {/* The keyboard path to the patient; the row click is the mouse's. */}
                        <Link
                          className="font-medium text-text hover:underline focus-visible:underline"
                          onClick={(event) => event.stopPropagation()}
                          params={{ patientId: debtor.patientId }}
                          to="/patients/$patientId"
                        >
                          {debtor.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap max-sm:hidden">
                        {debtor.phoneNumber ?? '—'}
                      </TableCell>
                      {showBranch ? <TableCell>{debtor.clinicName ?? '—'}</TableCell> : null}
                      <TableCell align="right" className="max-sm:hidden" isNumeric>
                        {money(debtor.charged)}
                      </TableCell>
                      <TableCell align="right" className="max-sm:hidden" isNumeric>
                        {money(debtor.paid)}
                      </TableCell>
                      <TableCell align="right" className="font-semibold text-danger" isNumeric>
                        {money(debtor.debt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              hasNext={data.next !== null}
              hasPrevious={page > 1}
              isLoading={query.isFetching}
              nextLabel={t('common:action.next')}
              onNext={() => onPageChange(page + 1)}
              onPrevious={() => onPageChange(page - 1)}
              previousLabel={t('common:action.previous')}
              summary={`${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + data.results.length} / ${data.count}`}
            />
          </>
        )}
      </QueryBoundary>
    </Card>
  )
}
