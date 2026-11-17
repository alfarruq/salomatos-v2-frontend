import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Administrator, administratorQueries } from '@/entities/administrator'
import { clinicQueries } from '@/entities/clinic'
import { useCan } from '@/entities/session'
import { CreateAdministratorDialog } from '@/features/administrator-create'
import { DeleteAdministratorDialog } from '@/features/administrator-delete'
import { EditAdministratorDialog } from '@/features/administrator-edit'
import {
  AdministratorMoneySwitches,
  AdministratorsMoneySwitch,
} from '@/features/administrator-money-access'
import { InactiveStaffList } from '@/features/staff-reactivate'
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

export interface AdministratorTableProps {
  clinicId: string
}

/** Shown when the server had nothing to send for a cell. */
const EMPTY = '—'

/**
 * The clinic's admin accounts: edit (including a new password), deactivate,
 * and bring a deactivated one back.
 */
export function AdministratorTable({ clinicId }: AdministratorTableProps) {
  const { t } = useTranslation(['admin', 'common'])
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<Administrator | null>(null)
  const [editing, setEditing] = useState<Administrator | null>(null)

  const query = useQuery(administratorQueries.list(clinicId))
  const inactiveQuery = useQuery(administratorQueries.inactive(clinicId))
  const managesMoney = useCan('clinic:manage')
  const clinicQuery = useQuery({ ...clinicQueries.mine(clinicId), enabled: managesMoney })
  const adminsSeeMoney = clinicQuery.data?.adminsSeeMoney ?? true

  return (
    // As wide as its content (never the full width of a large monitor), but never wider than the screen.
    <div className="flex w-fit max-w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-callout text-text-secondary">{t('admin:administrator.description')}</p>
        <Button onClick={() => setCreateOpen(true)} size="sm" variant="primary">
          {t('admin:administrator.create')}
        </Button>
      </div>

      {managesMoney ? <AdministratorsMoneySwitch clinicId={clinicId} /> : null}

      <QueryBoundary
        empty={
          <EmptyState
            action={
              <Button onClick={() => setCreateOpen(true)} variant="primary">
                {t('admin:administrator.create')}
              </Button>
            }
            description={t('admin:administrator.emptyDescription')}
            title={t('admin:administrator.empty')}
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
            <TableSkeleton columns={3 + (managesMoney ? 1 : 0)} rows={3} />
          </Table>
        }
        query={query}
      >
        {(administrators) => (
          <Table density="comfortable">
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin:administrator.fullName')}</TableHead>
                <TableHead>{t('admin:administrator.contact')}</TableHead>
                {managesMoney ? (
                  <TableHead>{t('admin:administrator.money.column')}</TableHead>
                ) : null}
                <TableHead align="right">{t('common:action.edit')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {administrators.map((administrator) => (
                <TableRow key={administrator.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {/* One fixed colour for every admin: unlike doctors they have no specialty to tell apart. */}
                      <Avatar className="size-10" name={administrator.fullName} tone={6} />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold text-text">{administrator.fullName}</span>
                        {administrator.username === null ? null : (
                          <span className="text-callout text-text-secondary">
                            @{administrator.username}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="whitespace-nowrap">
                        {administrator.phoneNumber === null
                          ? EMPTY
                          : `+998-${formatSubscriber(subscriberDigitsOf(administrator.phoneNumber))}`}
                      </span>
                      {administrator.email === null ? null : (
                        <span className="text-callout text-text-secondary">
                          {administrator.email}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {managesMoney ? (
                    <TableCell>
                      <AdministratorMoneySwitches
                        administrator={administrator}
                        clinicId={clinicId}
                        disabled={!adminsSeeMoney}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell align="right">
                    <div className="flex justify-end gap-1">
                      <Button
                        aria-label={`${t('common:action.edit')} — ${administrator.fullName}`}
                        onClick={() => setEditing(administrator)}
                        size="sm"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        aria-label={`${t('common:action.delete')} — ${administrator.fullName}`}
                        onClick={() => setDeleting(administrator)}
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

      <InactiveStaffList clinicId={clinicId} staff={inactiveQuery.data ?? []} />

      <CreateAdministratorDialog
        clinicId={clinicId}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />

      {editing === null ? null : (
        <EditAdministratorDialog
          administrator={editing}
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          open
        />
      )}

      {deleting === null ? null : (
        <DeleteAdministratorDialog
          administrator={deleting}
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          open
        />
      )}
    </div>
  )
}
