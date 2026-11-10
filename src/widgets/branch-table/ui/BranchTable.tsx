import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Branch, branchQueries } from '@/entities/branch'
import { CloseBranchDialog, ReopenBranchButton } from '@/features/branch-close'
import { CreateBranchDialog } from '@/features/branch-create'
import { EditBranchDialog } from '@/features/branch-edit'
import { MovePatientsDialog } from '@/features/branch-move-patients'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  QueryBoundary,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/shared/ui'

export interface BranchTableProps {
  clinicId: string
  /** The branch the owner is working in now: it cannot be closed from inside itself. */
  currentBranch: { id: string; name: string }
}

/**
 * The organization's branches. A clinic with one branch sees one row and never
 * needs this screen; everything else in the app already works per branch.
 */
export function BranchTable({ clinicId, currentBranch }: BranchTableProps) {
  const { t } = useTranslation(['admin', 'common'])
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [closing, setClosing] = useState<Branch | null>(null)
  const [movingTo, setMovingTo] = useState<Branch | null>(null)

  const query = useQuery(branchQueries.list(clinicId))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-callout text-text-secondary">{t('admin:branch.description')}</p>
        <Button onClick={() => setCreateOpen(true)} size="sm" variant="primary">
          {t('admin:branch.create')}
        </Button>
      </div>

      <QueryBoundary
        empty={
          <EmptyState
            action={
              <Button onClick={() => setCreateOpen(true)} variant="primary">
                {t('admin:branch.create')}
              </Button>
            }
            description={t('admin:branch.emptyDescription')}
            title={t('admin:branch.empty')}
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
            <TableSkeleton columns={5} rows={2} />
          </Table>
        }
        query={query}
      >
        {(branches) => (
          <Table density="compact">
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin:branch.name')}</TableHead>
                <TableHead>{t('admin:branch.address')}</TableHead>
                <TableHead align="right">{t('admin:branch.staff')}</TableHead>
                <TableHead align="right">{t('admin:branch.patients')}</TableHead>
                <TableHead align="right">{t('common:action.edit')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-text">{branch.name}</span>
                      {branch.id === currentBranch.id ? (
                        <Badge tone="accent">{t('admin:branch.current')}</Badge>
                      ) : null}
                      {branch.isActive ? null : (
                        <Badge tone="neutral">{t('admin:branch.closed')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-text-secondary">{branch.address || '—'}</span>
                  </TableCell>
                  <TableCell align="right">{branch.staffCount}</TableCell>
                  <TableCell align="right">{branch.patientCount}</TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-1">
                      <Button
                        aria-label={`${t('common:action.edit')} — ${branch.name}`}
                        onClick={() => setEditing(branch)}
                        size="sm"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      {branch.isActive && branch.id !== currentBranch.id ? (
                        <Button onClick={() => setMovingTo(branch)} size="sm" variant="ghost">
                          {t('admin:branch.move.action')}
                        </Button>
                      ) : null}
                      {branch.isActive ? (
                        branch.id === currentBranch.id ? null : (
                          <Button onClick={() => setClosing(branch)} size="sm" variant="ghost">
                            {t('admin:branch.close')}
                          </Button>
                        )
                      ) : (
                        <ReopenBranchButton branch={branch} clinicId={clinicId} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryBoundary>

      <CreateBranchDialog
        clinicId={clinicId}
        currentBranch={currentBranch}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />

      {editing === null ? null : (
        <EditBranchDialog
          branch={editing}
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          open
        />
      )}

      {movingTo === null ? null : (
        <MovePatientsDialog
          clinicId={clinicId}
          currentBranchName={currentBranch.name}
          onOpenChange={(open) => {
            if (!open) setMovingTo(null)
          }}
          open
          target={movingTo}
        />
      )}

      {closing === null ? null : (
        <CloseBranchDialog
          branch={closing}
          clinicId={clinicId}
          onOpenChange={(open) => {
            if (!open) setClosing(null)
          }}
          open
        />
      )}
    </div>
  )
}
