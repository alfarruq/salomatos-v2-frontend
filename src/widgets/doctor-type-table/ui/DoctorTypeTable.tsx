import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DoctorType } from '@/entities/doctor-type'
import { doctorTypeQueries, isDentalDoctorType } from '@/entities/doctor-type'
import { CreateDoctorTypeDialog } from '@/features/doctor-type-create'
import { DeleteDoctorTypeDialog } from '@/features/doctor-type-delete'
import { EditDoctorTypeDialog } from '@/features/doctor-type-edit'
import {
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

export interface DoctorTypeTableProps {
  clinicId: string
}

/**
 * Doctor categories a clinic can assign — "Stomatolog", "Ortodont".
 *
 * No pagination and no search: the endpoint returns a plain array and a
 * clinic has a handful of these, not thousands.
 */
export function DoctorTypeTable({ clinicId }: DoctorTypeTableProps) {
  const { t } = useTranslation(['admin', 'common'])
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<DoctorType | null>(null)
  const [deleting, setDeleting] = useState<DoctorType | null>(null)

  const query = useQuery(doctorTypeQueries.list(clinicId))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-callout text-text-secondary">{t('admin:doctorType.description')}</p>
        <Button onClick={() => setCreateOpen(true)} size="sm" variant="primary">
          {t('admin:doctorType.create')}
        </Button>
      </div>

      <QueryBoundary
        empty={
          <EmptyState
            action={
              <Button onClick={() => setCreateOpen(true)} variant="primary">
                {t('admin:doctorType.create')}
              </Button>
            }
            description={t('admin:doctorType.emptyDescription')}
            title={t('admin:doctorType.empty')}
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
            <TableSkeleton columns={2} rows={4} />
          </Table>
        }
        query={query}
      >
        {(doctorTypes) => (
          <Table density="compact">
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin:doctorType.name')}</TableHead>
                <TableHead align="right">{t('common:action.edit')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {doctorTypes.map((doctorType) => (
                <TableRow key={doctorType.id}>
                  <TableCell>{doctorType.name}</TableCell>
                  <TableCell align="right">
                    {/* The dental type is the clinic default and drives the tooth chart by name, so renaming or deleting it would break treatments. */}
                    {isDentalDoctorType(doctorType.name) ? null : (
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label={`${t('common:action.edit')} — ${doctorType.name}`}
                          onClick={() => setEditing(doctorType)}
                          size="sm"
                          variant="ghost"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          aria-label={`${t('common:action.delete')} — ${doctorType.name}`}
                          onClick={() => setDeleting(doctorType)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryBoundary>

      <CreateDoctorTypeDialog
        clinicId={clinicId}
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
      />

      {editing === null ? null : (
        <EditDoctorTypeDialog
          clinicId={clinicId}
          doctorType={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          open
        />
      )}

      {deleting === null ? null : (
        <DeleteDoctorTypeDialog
          clinicId={clinicId}
          doctorType={deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          open
        />
      )}
    </div>
  )
}
