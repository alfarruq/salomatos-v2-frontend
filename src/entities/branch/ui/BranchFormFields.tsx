import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Field, Input, PhoneInput } from '@/shared/ui'
import type { BranchFormInput } from '../model/formSchema'

export interface BranchFormFieldsProps {
  form: UseFormReturn<BranchFormInput>
  isDisabled?: boolean
}

/** A branch's writable fields. Passive — the feature owns the mutation (§3.2). */
export function BranchFormFields({ form, isDisabled = false }: BranchFormFieldsProps) {
  const { t } = useTranslation(['admin', 'validation'])

  const message = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const errors = form.formState.errors

  return (
    <div className="flex flex-col gap-4">
      <Field error={message(errors.name?.message)} isRequired label={t('admin:branch.name')}>
        <Input
          autoComplete="off"
          disabled={isDisabled}
          placeholder={t('admin:branch.namePlaceholder')}
          {...form.register('name')}
        />
      </Field>

      <Field error={message(errors.phoneNumber?.message)} label={t('admin:branch.phoneNumber')}>
        <Controller
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <PhoneInput
              disabled={isDisabled}
              name={field.name}
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
      </Field>

      <Field error={message(errors.address?.message)} label={t('admin:branch.address')}>
        <Input autoComplete="off" disabled={isDisabled} {...form.register('address')} />
      </Field>
    </div>
  )
}
