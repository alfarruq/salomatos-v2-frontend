import type { ReactNode } from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { DateInput, Field, Input, PhoneInput, Select, type SelectOption } from '@/shared/ui'
import type { PatientFormInput } from '../model/formSchema'

export interface PatientFormFieldsProps {
  form: UseFormReturn<PatientFormInput>
  isDisabled?: boolean
  /**
   * Doctor choices, as plain `{value, label}` pairs — an entity may not import
   * another entity (§4), so the feature fetching the list converts it first,
   * same as `AppointmentFormFields.doctorOptions`.
   */
  doctorOptions: SelectOption[]
  /** Rendered right under the name and phone, e.g. the new-patient dialog's lead suggestions. */
  afterContact?: ReactNode
}

/**
 * The patient's writable fields, and nothing else — no submit button, no
 * mutation, no dialog.
 *
 * That is what keeps it an entity (§3.2): it renders the shape of a patient
 * and hands every decision back to whichever feature owns the form. Creating
 * and editing then share one definition of what the fields are without either
 * feature importing the other, which §4 forbids.
 */
// Defaulted rather than forwarded as `boolean | undefined`: under
// `exactOptionalPropertyTypes` those are different types, and the controls
// below declare `disabled?: boolean`.
export function PatientFormFields({
  form,
  isDisabled = false,
  doctorOptions,
  afterContact,
}: PatientFormFieldsProps) {
  const { t } = useTranslation(['patients', 'validation'])

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
        label={t('patients:form.fullName')}
      >
        <Input autoComplete="off" disabled={isDisabled} {...form.register('fullName')} />
      </Field>

      <Field
        error={message(errors.phoneNumber?.message)}
        isRequired
        label={t('patients:form.phoneNumber')}
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

      {afterContact}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field error={message(errors.doctorId?.message)} label={t('patients:form.doctor')}>
          <Controller
            control={form.control}
            name="doctorId"
            render={({ field }) => (
              <Select
                disabled={isDisabled}
                name={field.name}
                onValueChange={field.onChange}
                options={doctorOptions}
                placeholder={t('patients:form.doctorPlaceholder')}
                value={field.value}
              />
            )}
          />
        </Field>

        <Field error={message(errors.birthDate?.message)} label={t('patients:form.birthDate')}>
          <Controller
            control={form.control}
            name="birthDate"
            render={({ field }) => (
              <DateInput
                disabled={isDisabled}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                placeholder={t('patients:form.birthDatePlaceholder')}
                value={field.value}
              />
            )}
          />
        </Field>
      </div>

      <Field error={message(errors.address?.message)} label={t('patients:form.address')}>
        <Input autoComplete="off" disabled={isDisabled} {...form.register('address')} />
      </Field>

      <Field error={message(errors.gender?.message)} label={t('patients:form.gender')}>
        <Controller
          control={form.control}
          name="gender"
          render={({ field }) => (
            <Select
              disabled={isDisabled}
              name={field.name}
              onValueChange={field.onChange}
              options={[
                { value: 'male', label: t('patients:gender.male') },
                { value: 'female', label: t('patients:gender.female') },
              ]}
              placeholder={t('patients:form.genderPlaceholder')}
              value={field.value}
            />
          )}
        />
      </Field>

      <Field error={message(errors.notes?.message)} label={t('patients:form.notes')}>
        <Input autoComplete="off" disabled={isDisabled} {...form.register('notes')} />
      </Field>
    </div>
  )
}
