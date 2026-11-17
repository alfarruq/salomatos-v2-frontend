import { useQuery } from '@tanstack/react-query'
import { KeyRound, Pencil, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clinicQueries } from '@/entities/clinic'
import type { Doctor } from '@/entities/doctor'
import { doctorQueries } from '@/entities/doctor'
import { DoctorTypeBadge, doctorTypeToneOf } from '@/entities/doctor-type'
import { CompensationBadge } from '@/entities/expense'
import { useCan } from '@/entities/session'
import { BotAccessDialog } from '@/features/bot-access-manage'
import { CompensationDialog } from '@/features/doctor-compensation-set'
import { CreateDoctorDialog } from '@/features/doctor-create'
import { DeleteDoctorDialog } from '@/features/doctor-delete'
import { EditDoctorDialog } from '@/features/doctor-edit'
import { DoctorMoneySwitch, DoctorsMoneySwitch } from '@/features/doctor-money-access'
import { InactiveStaffList } from '@/features/staff-reactivate'
import { currentMonth } from '@/shared/lib/calendarMonth'
import {
  Avatar,
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
  const { t } = useTranslation(['admin', 'common', 'expenses', 'bot'])
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [settingPay, setSettingPay] = useState<Doctor | null>(null)
  // UX only: the server leaves terms out of the rows and refuses changes without these.
  const seesPay = useCan('payroll:view')
  const managesPay = useCan('payroll:manage')
  // Owner-only on the server (`clinic:manage`); admins never see the switches.
  const managesMoney = useCan('clinic:manage')
  const clinicQuery = useQuery({ ...clinicQueries.mine(clinicId), enabled: managesMoney })
  const doctorsSeeMoney = clinicQuery.data?.doctorsSeeMoney ?? true
  const [deleting, setDeleting] = useState<Doctor | null>(null)
  const [showingBot, setShowingBot] = useState<Doctor | null>(null)

  const query = useQuery(doctorQueries.list(clinicId))
  const inactiveQuery = useQuery(doctorQueries.inactive(clinicId))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-callout text-text-secondary">{t('admin:doctor.description')}</p>
        <Button onClick={() => setCreateOpen(true)} size="sm" variant="primary">
          {t('admin:doctor.create')}
        </Button>
      </div>

      {managesMoney ? <DoctorsMoneySwitch clinicId={clinicId} /> : null}

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
          <Table density="comfortable">
            <TableSkeleton columns={4 + (seesPay ? 1 : 0) + (managesMoney ? 1 : 0)} rows={4} />
          </Table>
        }
        query={query}
      >
        {(doctors) => (
          <Table density="comfortable">
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin:doctor.fullName')}</TableHead>
                <TableHead>{t('admin:doctor.type')}</TableHead>
                <TableHead>{t('admin:doctor.contact')}</TableHead>
                {seesPay ? <TableHead>{t('admin:doctor.pay')}</TableHead> : null}
                {managesMoney ? <TableHead>{t('admin:doctor.money.column')}</TableHead> : null}
                <TableHead align="right">{t('common:action.edit')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {doctors.map((doctor) => {
                const typeTone = doctorTypeToneOf(doctor.doctorTypeId, doctor.isDental)
                return (
                  <TableRow key={doctor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {/* Same colour as the type badge, so a specialty is recognisable down the list. */}
                        <Avatar
                          className="size-10"
                          name={doctor.fullName}
                          {...(typeTone === undefined ? {} : { tone: typeTone })}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-semibold text-text">{doctor.fullName}</span>
                          {doctor.username === null ? null : (
                            <span className="text-callout text-text-secondary">
                              @{doctor.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {doctor.doctorTypeName === null ? (
                        EMPTY
                      ) : (
                        <DoctorTypeBadge name={doctor.doctorTypeName} tone={typeTone} />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {doctor.phoneNumber === null
                            ? EMPTY
                            : `+998-${formatSubscriber(subscriberDigitsOf(doctor.phoneNumber))}`}
                        </span>
                        {doctor.email === null ? null : (
                          <span className="text-callout text-text-secondary">{doctor.email}</span>
                        )}
                      </div>
                    </TableCell>
                    {seesPay ? (
                      <TableCell>
                        {doctor.currentPay === null && managesPay ? (
                          // Missing terms are the one thing to act on here, so the label opens the form.
                          <button
                            aria-label={`${t('expenses:payroll.terms.open')} — ${doctor.fullName}`}
                            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            onClick={() => setSettingPay(doctor)}
                            type="button"
                          >
                            <CompensationBadge compensation={null} />
                          </button>
                        ) : (
                          <CompensationBadge compensation={doctor.currentPay} />
                        )}
                      </TableCell>
                    ) : null}
                    {managesMoney ? (
                      <TableCell>
                        <DoctorMoneySwitch
                          clinicId={clinicId}
                          disabled={!doctorsSeeMoney}
                          doctor={doctor}
                        />
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
                          aria-label={`${t('bot:open')} — ${doctor.fullName}`}
                          onClick={() => setShowingBot(doctor)}
                          size="sm"
                          variant="ghost"
                        >
                          <KeyRound aria-hidden="true" className="size-4" />
                        </Button>
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
                )
              })}
            </TableBody>
          </Table>
        )}
      </QueryBoundary>

      <InactiveStaffList clinicId={clinicId} staff={inactiveQuery.data ?? []} />

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

      {showingBot === null ? null : (
        <BotAccessDialog
          clinicId={clinicId}
          name={showingBot.fullName}
          onOpenChange={(open) => {
            if (!open) setShowingBot(null)
          }}
          open
          target={{ kind: 'staff', id: showingBot.id }}
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
