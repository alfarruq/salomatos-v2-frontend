import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Field, Input, PasswordInput, PhoneInput } from '@/shared/ui'
import type { AdministratorFormInput } from '../model/formSchema'

export interface AdministratorFormFieldsProps {
  form: UseFormReturn<AdministratorFormInput>
  isDisabled?: boolean
  /** `edit` treats an empty password as "keep the current one". */
  mode?: 'create' | 'edit'
}

/** An admin's writable fields, and nothing else — no submit, no mutation. */
export function AdministratorFormFields({
  form,
  isDisabled = false,
  mode = 'create',
}: AdministratorFormFieldsProps) {
  const { t } = useTranslation(['admin', 'validation'])

  /** Valibot and the server both speak `validation.<code>` — see §10. */
  const message = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const errors = form.formState.errors

  return (
    <div className="flex flex-col gap-4">
      <Field
        error={message(errors.fullName?.message)}
        isRequired
        label={t('admin:administrator.fullName')}
      >
        <Input autoComplete="off" disabled={isDisabled} {...form.register('fullName')} />
      </Field>

      <Field
        error={message(errors.phoneNumber?.message)}
        isRequired
        label={t('admin:administrator.phoneNumber')}
      >
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

      <Field error={message(errors.email?.message)} label={t('admin:administrator.email')}>
        <Input autoComplete="off" disabled={isDisabled} type="email" {...form.register('email')} />
      </Field>

      <Field
        error={message(errors.username?.message)}
        isRequired
        label={t('admin:administrator.username')}
      >
        <Input
          autoCapitalize="none"
          autoComplete="off"
          disabled={isDisabled}
          spellCheck={false}
          {...form.register('username')}
        />
      </Field>

      <Field
        description={mode === 'edit' ? t('admin:doctor.passwordKeep') : undefined}
        error={message(errors.password?.message)}
        isRequired={mode === 'create'}
        label={
          mode === 'create' ? t('admin:administrator.password') : t('admin:doctor.newPassword')
        }
      >
        {/* `new-password` stops the browser from filling in the superadmin's own login. */}
        <PasswordInput
          autoComplete="new-password"
          disabled={isDisabled}
          hideLabel={t('common:action.hidePassword')}
          showLabel={t('common:action.showPassword')}
          {...form.register('password')}
        />
      </Field>
    </div>
  )
}
