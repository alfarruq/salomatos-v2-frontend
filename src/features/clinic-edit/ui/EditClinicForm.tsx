import { valibotResolver } from '@hookform/resolvers/valibot'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  type Clinic,
  ClinicFormFields,
  type ClinicFormInput,
  clinicFormFieldOf,
  clinicFormSchema,
  toClinicForm,
} from '@/entities/clinic'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Card, toast } from '@/shared/ui'
import { useUpdateClinic } from '../model/useUpdateClinic'

export interface EditClinicFormProps {
  clinicId: string
  clinic: Clinic
}

/**
 * First-time setup for the clinic's own profile.
 *
 * A plain form on the page rather than a dialog: there is nothing to compare
 * it against yet, and once it exists this screen is replaced by
 * `ClinicSummaryCard` — see `pages/_auth/manage/clinic.tsx`.
 */
export function EditClinicForm({ clinicId, clinic }: EditClinicFormProps) {
  const { t } = useTranslation(['admin', 'common'])

  const form = useForm<ClinicFormInput>({
    resolver: valibotResolver(clinicFormSchema),
    mode: 'onBlur',
    defaultValues: toClinicForm(clinic),
  })

  const { mutate, isPending } = useUpdateClinic(clinicId)

  const handleSubmit = form.handleSubmit((values) =>
    mutate(values, {
      onSuccess: () => toast.success(t('admin:clinic.saved')),
      onError: (error) => {
        if (!(error instanceof ApiError)) {
          form.setError('root', { message: t('admin:clinic.createFailed') })
          return
        }

        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const first = messages[0]
          if (first === undefined) continue
          form.setError(clinicFormFieldOf(field), { message: first })
        }

        if (Object.keys(error.fieldErrors).length === 0) {
          form.setError('root', {
            message:
              error.kind === 'network' ? t('common:error.network') : t('admin:clinic.createFailed'),
          })
        }
      },
    }),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Card className="flex max-w-lg flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-title2 text-text">{t('admin:clinic.editTitle')}</h2>
        <p className="text-callout text-text-secondary">{t('admin:clinic.editDescription')}</p>
      </div>

      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <ClinicFormFields form={form} isDisabled={isPending} />

        <div>
          <Button isLoading={isPending} type="submit" variant="primary">
            {t('common:action.save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
