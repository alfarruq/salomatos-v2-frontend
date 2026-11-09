import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  type MedicalHistory,
  type MedicalHistoryInput,
  type PatientId,
  toMedicalHistoryInput,
} from '@/entities/patient'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, Field, RadioGroup, Textarea } from '@/shared/ui'
import { useUpdateMedicalHistory } from '../model/useUpdateMedicalHistory'

export interface EditMedicalHistoryDialogProps {
  clinicId: string
  patientId: PatientId
  history: MedicalHistory
  showPregnancy: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'edit-medical-history-form'

export function EditMedicalHistoryDialog({
  clinicId,
  patientId,
  history,
  showPregnancy,
  open,
  onOpenChange,
}: EditMedicalHistoryDialogProps) {
  const { t } = useTranslation(['patients', 'common'])
  const form = useForm<MedicalHistoryInput>({ defaultValues: toMedicalHistoryInput(history) })
  const { reset } = form

  // Refill on every opening, so a refetch or another patient never leaves stale text behind.
  useEffect(() => {
    if (open) reset(toMedicalHistoryInput(history))
  }, [open, history, reset])

  const { mutate, isPending } = useUpdateMedicalHistory(clinicId)

  const handleSubmit = form.handleSubmit((input) =>
    mutate(
      { patientId, input },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          form.setError('root', {
            message:
              error instanceof ApiError && error.kind === 'network'
                ? t('common:error.network')
                : t('patients:medicalHistory.failed'),
          })
        },
      },
    ),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      className="max-w-xl"
      description={t('patients:medicalHistory.description')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('common:action.save')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('patients:medicalHistory.title')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <Field label={t('patients:medicalHistory.allergies')}>
          <Textarea
            disabled={isPending}
            placeholder={t('patients:medicalHistory.allergiesPlaceholder')}
            rows={2}
            {...form.register('allergies')}
          />
        </Field>
        <Field label={t('patients:medicalHistory.chronicConditions')}>
          <Textarea disabled={isPending} rows={2} {...form.register('chronicConditions')} />
        </Field>
        <Field label={t('patients:medicalHistory.currentMedications')}>
          <Textarea disabled={isPending} rows={2} {...form.register('currentMedications')} />
        </Field>
        {showPregnancy ? (
          <Field label={t('patients:medicalHistory.pregnancy')}>
            <Controller
              control={form.control}
              name="isPregnant"
              render={({ field }) => (
                <RadioGroup
                  disabled={isPending}
                  name={field.name}
                  onValueChange={field.onChange}
                  options={[
                    { value: 'unknown', label: t('patients:medicalHistory.pregnancyUnknown') },
                    { value: 'no', label: t('patients:medicalHistory.pregnancyNo') },
                    { value: 'yes', label: t('patients:medicalHistory.pregnancyYes') },
                  ]}
                  orientation="horizontal"
                  value={field.value}
                />
              )}
            />
          </Field>
        ) : null}
        <Field label={t('patients:medicalHistory.notes')}>
          <Textarea disabled={isPending} rows={2} {...form.register('notes')} />
        </Field>
      </form>
    </Dialog>
  )
}
