import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Doctor } from '@/entities/doctor'
import { doctorQueries } from '@/entities/doctor'
import { CompensationTerms } from '@/entities/expense'
import { useCan } from '@/entities/session'
import { CompensationDialog } from '@/features/doctor-compensation-set'
import { CreateDoctorDialog } from '@/features/doctor-create'
import { DeleteDoctorDialog } from '@/features/doctor-delete'
import { EditDoctorDialog } from '@/features/doctor-edit'
import { currentMonth } from '@/shared/lib/calendarMonth'
import {
  Button,
  EmptyState,
  ErrorState,
  formatSubscriber,
  QueryBoundary,
  subscriberDigitsOf,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/shared/ui'

export interface DoctorTableProps {
  clinicId: string
}

/** Shown when the server had nothing to send for a cell. */
const EMPTY = '—'

/**
 * The clinic's doctors, with the actions that manage them.
 *
 * No pagination: `/clinic/doctors/` returns a plain array, and a clinic has
 * tens of staff rather than thousands. No search either, for the same reason —
 * the list fits on a screen.
 */
export function DoctorTable({ clinicId }: DoctorTableProps) {
  const { t } = useTranslation(['admin', 'common', 'expenses'])
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [settingPay, setSettingPay] = useState<Doctor | null>(null)
  // UX only: the server leaves terms out of the rows and refuses changes without these.
  const seesPay = useCan('payroll:view')
  const managesPay = useCan('payroll:manage')
  const [deleting, setDeleting] = useState<Doctor | null>(null)

  const query = useQuery(doctorQueries.list(clinicId))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-callout text-text-secondary">{t('admin:doctor.description')}</p>
        <Button onClick={() => setCreateOpen(true)} size="sm" variant="primary">
          {t('admin:doctor.create')}
        </Button>
      </div>

      <QueryBoundary
        empty={
          <EmptyState
            action={
              <Button onClick={() => setCreateOpen(true)} variant="primary">
                {t('admin:doctor.create')}
              </Button>
            }
            description={t('admin:doctor.emptyDescription')}
            title={t('admin:doctor.empty')}
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
            <TableSkeleton columns={seesPay ? 6 : 5} rows={4} />
          </Table>
        }
        query={query}
      >
        {(doctors) => (
          <Table density="compact">
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin:doctor.fullName')}</TableHead>
                <TableHead>{t('admin:doctor.username')}</TableHead>
                <TableHead>{t('admin:doctor.type')}</TableHead>
                <TableHead>{t('admin:doctor.phoneNumber')}</TableHead>
                <TableHead>{t('admin:doctor.email')}</TableHead>
                {seesPay ? <TableHead>{t('admin:doctor.pay')}</TableHead> : null}
                <TableHead align="right">{t('common:action.edit')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id}>
                  <TableCell>{doctor.fullName}</TableCell>
                  <TableCell>{doctor.username ?? EMPTY}</TableCell>
                  <TableCell>{doctor.doctorTypeName ?? EMPTY}</TableCell>
                  <TableCell>
                    {doctor.phoneNumber === null
                      ? EMPTY
                      : `+998-${formatSubscriber(subscriberDigitsOf(doctor.phoneNumber))}`}
                  </TableCell>
                  <TableCell>{doctor.email ?? EMPTY}</TableCell>
                  {seesPay ? (
                    <TableCell className="whitespace-normal">
                      <CompensationTerms compensation={doctor.currentPay} />
                    </TableCell>
                  ) : null}
                  <TableCell align="right">
                    <div className="flex justify-end gap-1">
                      {managesPay ? (
                        <Button
                          aria-label={`${t('expenses:payroll.terms.open')} — ${doctor.fullName}`}
                          onClick={() => setSettingPay(doctor)}
                          size="sm"
                          variant="ghost"
                        >
                          <Wallet aria-hidden="true" className="size-4" />
                        </Button>
                      ) : null}
                      <Button
                        aria-label={`${t('common:action.edit')} — ${doctor.fullName}`}
                        onClick={() => setEditing(doctor)}
                        size="sm"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        aria-label={`${t('common:action.delete')} — ${doctor.fullName}`}
                        onClick={() => setDeleting(doctor)}
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
        )}
      </QueryBoundary>

      <CreateDoctorDialog
        canSetPay={managesPay}
        clinicId={clinicId}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />

      {settingPay === null ? null : (
        <CompensationDialog
          clinicId={clinicId}
          doctor={{
            id: settingPay.id,
            name: settingPay.fullName,
            compensation: settingPay.currentPay,
          }}
          month={currentMonth()}
          onOpenChange={(open) => {
            if (!open) setSettingPay(null)
          }}
          open
        />
      )}

      {editing === null ? null : (
        <EditDoctorDialog
          clinicId={clinicId}
          doctor={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          open
        />
      )}

      {deleting === null ? null : (
        <DeleteDoctorDialog
          clinicId={clinicId}
          doctor={deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          open
        />
      )}
    </div>
  )
}
