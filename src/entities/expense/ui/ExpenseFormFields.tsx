import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { clinicNow } from '@/shared/lib/datetime'
import {
  DatePicker,
  Field,
  Input,
  MoneyInput,
  Select,
  type SelectOption,
  Textarea,
} from '@/shared/ui'
import type { ExpenseFormInput } from '../model/formSchema'
import { EXPENSE_CATEGORIES, EXPENSE_METHODS } from '../model/types'

export interface ExpenseFormFieldsProps {
  form: UseFormReturn<ExpenseFormInput>
  isDisabled?: boolean
  /**
   * Doctor choices as plain `{value, label}` pairs — an entity may not import
   * another entity (§4), so the feature that fetches the list converts it.
   */
  doctorOptions: SelectOption[]
}

/** An expense's writable fields. Passive — the feature owns the mutation (§3.2). */
export function ExpenseFormFields({
  form,
  isDisabled = false,
  doctorOptions,
}: ExpenseFormFieldsProps) {
  const { t, i18n } = useTranslation(['expenses', 'validation'])
  const category = useWatch({ control: form.control, name: 'category' })

  const message = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const errors = form.formState.errors

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={message(errors.date?.message)} isRequired label={t('expenses:form.date')}>
          <Controller
            control={form.control}
            name="date"
            render={({ field }) => (
              <DatePicker
                disabled={isDisabled}
                locale={i18n.language}
                // The clinic's today (§14): a payment that has not happened is not an expense.
                max={clinicNow().date}
                nextMonthLabel={t('expenses:form.nextMonth')}
                onChange={field.onChange}
                placeholder={t('expenses:form.datePlaceholder')}
                previousMonthLabel={t('expenses:form.previousMonth')}
                value={field.value}
              />
            )}
          />
        </Field>

        <Field error={message(errors.amount?.message)} isRequired label={t('expenses:form.amount')}>
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                disabled={isDisabled}
                name={field.name}
                onChange={field.onChange}
                placeholder="1,200,000"
                value={field.value}
              />
            )}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={message(errors.category?.message)}
          isRequired
          label={t('expenses:form.category')}
        >
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select
                disabled={isDisabled}
                name={field.name}
                onValueChange={field.onChange}
                options={EXPENSE_CATEGORIES.map((value) => ({
                  value,
                  label: t(`expenses:categories.${value}`),
                }))}
                placeholder={t('expenses:form.categoryPlaceholder')}
                value={field.value}
              />
            )}
          />
        </Field>

        <Field isRequired label={t('expenses:form.method')}>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <Select
                disabled={isDisabled}
                name={field.name}
                onValueChange={field.onChange}
                options={EXPENSE_METHODS.map((value) => ({
                  value,
                  label: t(`expenses:methods.${value}`),
                }))}
                value={field.value}
              />
            )}
          />
        </Field>
      </div>

      {category === 'doctor_share' ? (
        <Field
          error={message(errors.doctorId?.message)}
          isRequired
          label={t('expenses:form.doctor')}
        >
          <Controller
            control={form.control}
            name="doctorId"
            render={({ field }) => (
              <Select
                disabled={isDisabled}
                name={field.name}
                onValueChange={field.onChange}
                options={doctorOptions}
                placeholder={t('expenses:form.doctorPlaceholder')}
                value={field.value}
              />
            )}
          />
        </Field>
      ) : null}

      <Field
        description={t('expenses:form.payeeHint')}
        error={message(errors.payee?.message)}
        label={t('expenses:form.payee')}
      >
        <Input autoComplete="off" disabled={isDisabled} {...form.register('payee')} />
      </Field>

      {/* Free text is where a patient's name could slip in; the hint is the only guard here. */}
      <Field
        description={t('expenses:form.noteHint')}
        error={message(errors.note?.message)}
        label={t('expenses:form.note')}
      >
        <Textarea disabled={isDisabled} rows={3} {...form.register('note')} />
      </Field>
    </div>
  )
}
