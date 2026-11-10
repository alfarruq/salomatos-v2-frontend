import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Branch, branchQueries } from '@/entities/branch'
import { defaultPatientFilters, type Patient, patientQueries } from '@/entities/patient'
import { ApiError } from '@/shared/api/errors'
import { formatSom } from '@/shared/lib/money'
import { useDebounce } from '@/shared/lib/useDebounce'
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Field,
  Input,
  Pagination,
  Select,
  Skeleton,
} from '@/shared/ui'
import { useMovePatients } from '../model/useMovePatients'

export interface MovePatientsDialogProps {
  clinicId: string
  /** The branch the owner is in; its patients are the ones listed. */
  currentBranchName: string
  target: Branch
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Money stays in the old branch, so only a settled patient can leave it (server rule too). */
function isSettled(patient: Patient): boolean {
  return patient.debt === null || patient.debt === 0
}

export function MovePatientsDialog({
  clinicId,
  currentBranchName,
  target,
  open,
  onOpenChange,
}: MovePatientsDialogProps) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  // §3: the search text is PHI, so it lives in state, never in the URL.
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [doctorId, setDoctorId] = useState<string | undefined>(undefined)
  const [moved, setMoved] = useState<number | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  const patients = useQuery(
    patientQueries.list(clinicId, { ...defaultPatientFilters, search: debouncedSearch, page }),
  )
  const doctors = useQuery(branchQueries.doctors(clinicId, target.id))
  const { mutate, isPending, error, reset } = useMovePatients(clinicId)

  const toggle = (id: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : error instanceof ApiError && 'doctor' in error.fieldErrors
          ? t('admin:branch.move.doctorBusy')
          : error instanceof ApiError && 'patients' in error.fieldErrors
            ? t('admin:branch.move.notMovable')
            : t('admin:branch.move.failed')

  const close = () => {
    reset()
    setSelected(new Set())
    setMoved(null)
    onOpenChange(false)
  }

  const submit = () => {
    if (doctorId === undefined || selected.size === 0) return
    mutate(
      { targetBranchId: target.id, patientIds: [...selected], doctorId },
      {
        onSuccess: (result) => {
          setSelected(new Set())
          setMoved(result.moved)
        },
      },
    )
  }

  const doctorOptions = (doctors.data ?? []).map((doctor) => ({
    value: doctor.id,
    label: doctor.fullName,
  }))

  return (
    <Dialog
      description={t('admin:branch.move.description', {
        from: currentBranchName,
        to: target.name,
      })}
      footer={
        <>
          <Button disabled={isPending} onClick={close} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button
            disabled={selected.size === 0 || doctorId === undefined}
            isLoading={isPending}
            onClick={submit}
            variant="primary"
          >
            {t('admin:branch.move.submit', { count: selected.size })}
          </Button>
        </>
      }
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      open={open}
      title={t('admin:branch.move.title', { name: target.name })}
    >
      <div className="flex flex-col gap-4">
        {moved === null ? null : (
          <Alert title={t('admin:branch.move.done', { count: moved })} tone="success" />
        )}
        {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}

        <Field isRequired label={t('admin:branch.move.doctor')}>
          {doctors.isPending ? (
            <Skeleton className="h-11 w-full" />
          ) : doctorOptions.length === 0 ? (
            <p className="text-callout text-text-secondary">{t('admin:branch.move.noDoctors')}</p>
          ) : (
            <Select
              aria-label={t('admin:branch.move.doctor')}
              onValueChange={setDoctorId}
              options={doctorOptions}
              placeholder={t('admin:branch.move.doctorPlaceholder')}
              {...(doctorId === undefined ? {} : { value: doctorId })}
            />
          )}
        </Field>

        <Field label={t('admin:branch.move.search')}>
          <Input
            autoComplete="off"
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            value={search}
          />
        </Field>

        {patients.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : patients.isError ? (
          <Alert title={t('common:error.pageBody')} tone="danger" />
        ) : patients.data.results.length === 0 ? (
          <p className="text-callout text-text-secondary">{t('admin:branch.move.empty')}</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {patients.data.results.map((patient) => (
              <li className="flex items-center justify-between gap-3" key={patient.id}>
                <Checkbox
                  checked={selected.has(patient.id)}
                  disabled={!isSettled(patient) || isPending}
                  label={patient.fullName}
                  onCheckedChange={(checked) => toggle(patient.id, checked === true)}
                />
                {isSettled(patient) || patient.debt === null ? null : (
                  <span className="shrink-0 text-caption text-text-tertiary">
                    {t('admin:branch.move.hasBalance', {
                      amount: formatSom(patient.debt, i18n.language, t('common:currency.som')),
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {patients.data === undefined ? null : (
          <Pagination
            hasNext={patients.data.next !== null}
            hasPrevious={page > 1}
            isLoading={patients.isFetching}
            nextLabel={t('common:action.next')}
            onNext={() => setPage((value) => value + 1)}
            onPrevious={() => setPage((value) => Math.max(1, value - 1))}
            previousLabel={t('common:action.previous')}
          />
        )}

        <p className="text-caption text-text-tertiary">{t('admin:branch.move.moneyStays')}</p>
      </div>
    </Dialog>
  )
}
