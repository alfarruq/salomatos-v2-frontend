import { valibotResolver } from '@hookform/resolvers/valibot'
import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import {
  DoctorFormFields,
  type DoctorFormInput,
  doctorCreateFormSchema,
  doctorFormFieldOf,
  emptyDoctorForm,
} from '@/entities/doctor'
import { doctorTypeQueries } from '@/entities/doctor-type'
import {
  emptyPayTerms,
  PayTermsFields,
  type PayTermsInput,
  payTermsSchema,
  toPayTermsPayload,
} from '@/entities/expense'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useCreateDoctor } from '../model/useCreateDoctor'

export interface CreateDoctorDialogProps {
  clinicId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  /**
   * Whether this person agrees pay (`payroll:manage`, the owner). The server
   * refuses terms from anyone else; hiding the section just avoids the 400.
   */
  canSetPay?: boolean
}

const FORM_ID = 'create-doctor-form'

interface PayErrors {
  percent?: string | undefined
  fixed?: string | undefined
}

/** `payTermsSchema` issues, keyed by the input they belong to. */
function payErrorsOf(pay: PayTermsInput): PayErrors | null {
  const result = v.safeParse(payTermsSchema, pay)
  if (result.success) return null
  const flat = v.flatten<typeof payTermsSchema>(result.issues).nested ?? {}
  return { percent: flat.percent?.[0], fixed: flat.fixed?.[0] }
}

export function CreateDoctorDialog({
  clinicId,
  open,
  onOpenChange,
  onCreated,
  canSetPay = false,
}: CreateDoctorDialogProps) {
  const { t } = useTranslation(['admin', 'common', 'expenses', 'validation'])
  /*
   * Kept beside the form rather than in it: `DoctorFormFields` is shared with
   * the edit dialog and typed to the doctor's own fields, and terms are only
   * ever set here, at hiring.
   */
  const [pay, setPay] = useState<PayTermsInput>(emptyPayTerms)
  const [payErrors, setPayErrors] = useState<PayErrors>({})

  const form = useForm<DoctorFormInput>({
    resolver: valibotResolver(doctorCreateFormSchema),
    mode: 'onBlur',
    defaultValues: emptyDoctorForm,
  })

  const { mutate, isPending } = useCreateDoctor(clinicId)

  // `static` (§6.3) via `doctorTypeQueries` — this list changes as rarely as
  // the price list, and this dialog is the reason it exists.
  const doctorTypesQuery = useQuery(doctorTypeQueries.list(clinicId))
  const doctorTypeOptions = (doctorTypesQuery.data ?? []).map((doctorType) => ({
    value: String(doctorType.id),
    label: doctorType.name,
  }))

  const defaultDoctorTypeId = (doctorTypesQuery.data ?? []).find(
    // Every clinic has exactly one built-in dental type.
    (doctorType) => doctorType.isDental,
  )?.id

  const { setValue } = form
  /*
   * Runs once the list arrives and only while the field is untouched —
   * `dirtyFields`, not `isDirty`, so filling in the name first does not skip
   * this. `setValue` alone (no `shouldDirty`) keeps the field clean, so a
   * person who submits without looking at it is not treated as having made a
   * deliberate choice — same reasoning as the edit dialog's own dirty check.
   *
   * `onSuccess` below repeats this on `reset`, because `reset` clears
   * `dirtyFields` back to what it started as — untouched — and this effect's
   * dependencies would otherwise not fire again for a second doctor in a row.
   */
  useEffect(() => {
    if (defaultDoctorTypeId === undefined) return
    if (form.formState.dirtyFields.doctorTypeId) return

    setValue('doctorTypeId', String(defaultDoctorTypeId))
  }, [defaultDoctorTypeId, form.formState.dirtyFields.doctorTypeId, setValue])

  // The dialog stays mounted while closed, so a typed password would otherwise
  // sit in memory and reappear the next time it opens.
  useEffect(() => {
    if (!open) setValue('password', '')
  }, [open, setValue])

  const translate = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const submitForm = form.handleSubmit((values) => {
    const invalidPay = canSetPay ? payErrorsOf(pay) : null
    if (invalidPay !== null) return
    mutate(
      { doctor: values, compensation: canSetPay ? toPayTermsPayload(pay) : null },
      {
        onSuccess: () => {
          // Reset to the default type, not to unassigned — otherwise adding a
          // second doctor in a row would silently lose the starting point the
          // first one had, since `reset` is what clears `dirtyFields` back to
          // untouched and the effect above has nothing left to react to.
          form.reset({
            ...emptyDoctorForm,
            doctorTypeId: defaultDoctorTypeId === undefined ? '' : String(defaultDoctorTypeId),
          })
          setPay(emptyPayTerms)
          setPayErrors({})
          onOpenChange(false)
          onCreated?.()
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('admin:doctor.createFailed') })
            return
          }

          // §10 — the likely rejection here is `unique_phone_per_clinic`, which
          // belongs on the phone input rather than in a banner.
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            // Terms are nested on the wire, so their errors come back as `compensation.percent`.
            if (field === 'compensation.percent' || field === 'compensation.fixed') {
              const key = field === 'compensation.percent' ? 'percent' : 'fixed'
              setPayErrors((current) => ({ ...current, [key]: first }))
              continue
            }
            form.setError(doctorFormFieldOf(field), { message: first })
          }

          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network'
                  ? t('common:error.network')
                  : t('admin:doctor.createFailed'),
            })
          }
        },
      },
    )
  })

  // Both halves are checked on every submit, so pay errors show with the others.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (canSetPay) setPayErrors(payErrorsOf(pay) ?? {})
    void submitForm(event)
  }

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      description={t('admin:doctor.createDescription')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('admin:doctor.create')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:doctor.createTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <DoctorFormFields
          doctorTypeOptions={doctorTypeOptions}
          form={form}
          isDisabled={isPending}
          mode="create"
        />
        {canSetPay ? (
          <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
            <legend className="text-callout font-medium text-text">
              {t('expenses:payroll.terms.title')}
            </legend>
            <p className="text-caption text-text-secondary">
              {t('expenses:payroll.terms.hiringHint')}
            </p>
            <PayTermsFields
              allowNone
              errors={{ percent: translate(payErrors.percent), fixed: translate(payErrors.fixed) }}
              isDisabled={isPending}
              onChange={setPay}
              value={pay}
            />
          </fieldset>
        ) : null}
      </form>
    </Dialog>
  )
}
