import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Payment, paymentQueries } from '@/entities/payment'
import { Can } from '@/entities/session'
import { RecordPaymentDialog } from '@/features/payment-create'
import { VoidPaymentDialog } from '@/features/payment-void'
import { CLINIC_TZ, formatDate } from '@/shared/lib/datetime'
import { formatSom } from '@/shared/lib/money'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  QueryBoundary,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui'

export interface PatientBillingProps {
  clinicId: string
  patientId: string
}

/**
 * What the patient owes and what they have paid. ⚠️ PHI on screen: money next
 * to a patient. The balance is the server's figure, never summed here, so a
 * voided line can never be counted twice.
 */
export function PatientBilling({ clinicId, patientId }: PatientBillingProps) {
  const { t, i18n } = useTranslation(['finance', 'common'])
  const balanceQuery = useQuery(paymentQueries.balance(clinicId, patientId))
  const paymentsQuery = useQuery(paymentQueries.list(clinicId, patientId))
  const [isRecording, setIsRecording] = useState(false)
  const [voiding, setVoiding] = useState<Payment | null>(null)

  const money = (amount: number) => formatSom(amount, i18n.language, t('common:currency.som'))
  const debt = balanceQuery.data?.debt ?? 0

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title3 text-text">{t('finance:balance.title')}</h2>
        <Can permission="payment:manage">
          <Button onClick={() => setIsRecording(true)} size="sm" variant="primary">
            {t('finance:payment.record')}
          </Button>
        </Can>
      </div>

      <QueryBoundary
        error={({ retry }) => (
          <ErrorState
            description={t('common:error.pageBody')}
            title={t('common:error.pageTitle')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        isEmpty={() => false}
        loading={<Skeleton className="h-16 w-full" />}
        query={balanceQuery}
      >
        {(balance) => (
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-footnote text-text-secondary">{t('finance:balance.charged')}</dt>
              <dd className="text-body tabular-nums text-text">{money(balance.charged)}</dd>
            </div>
            <div>
              <dt className="text-footnote text-text-secondary">{t('finance:balance.paid')}</dt>
              <dd className="text-body tabular-nums text-text">{money(balance.paid)}</dd>
            </div>
            <div>
              <dt className="text-footnote text-text-secondary">{t('finance:balance.debt')}</dt>
              <dd
                className={
                  balance.debt > 0
                    ? 'text-body font-semibold tabular-nums text-danger'
                    : 'text-body tabular-nums text-text'
                }
              >
                {balance.debt > 0 ? money(balance.debt) : t('finance:balance.settled')}
              </dd>
            </div>
          </dl>
        )}
      </QueryBoundary>

      <h3 className="text-headline text-text">{t('finance:ledger.title')}</h3>
      <QueryBoundary
        empty={<EmptyState title={t('finance:ledger.empty')} />}
        error={({ retry }) => (
          <ErrorState
            description={t('common:error.pageBody')}
            title={t('common:error.pageTitle')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        loading={<Skeleton className="h-24 w-full" />}
        query={paymentsQuery}
      >
        {(payments) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('finance:ledger.date')}</TableHead>
                  <TableHead>{t('finance:ledger.method')}</TableHead>
                  <TableHead className="max-sm:hidden">{t('finance:ledger.receivedBy')}</TableHead>
                  <TableHead align="right">{t('finance:ledger.amount')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('finance:void.action')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDate(payment.paidAt, { locale: i18n.language, timeZone: CLINIC_TZ })}
                    </TableCell>
                    <TableCell>
                      {t(`finance:methods.${payment.method}`)}
                      {payment.status === 'voided' ? (
                        <p className="text-footnote text-text-tertiary">
                          {t('finance:ledger.voided', { reason: payment.voidReason ?? '—' })}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-sm:hidden">{payment.receivedByName ?? '—'}</TableCell>
                    <TableCell
                      align="right"
                      className={
                        payment.status === 'voided' ? 'line-through text-text-tertiary' : ''
                      }
                      isNumeric
                    >
                      {money(payment.amount)}
                    </TableCell>
                    <TableCell align="right">
                      {payment.status === 'received' ? (
                        <Can permission="payment:void">
                          <Button onClick={() => setVoiding(payment)} size="sm" variant="ghost">
                            {t('finance:void.action')}
                          </Button>
                        </Can>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      {isRecording ? (
        <RecordPaymentDialog
          clinicId={clinicId}
          onOpenChange={setIsRecording}
          open
          patientId={patientId}
          suggestedAmount={debt}
        />
      ) : null}
      {voiding === null ? null : (
        <VoidPaymentDialog
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setVoiding(null)
          }}
          open
          paymentId={voiding.id}
        />
      )}
    </Card>
  )
}
