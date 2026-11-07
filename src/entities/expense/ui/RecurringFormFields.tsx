import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Field, Input, MoneyInput, Select } from '@/shared/ui'
import type { RecurringFormInput } from '../model/formSchema'
import { EXPENSE_METHODS, RECURRING_CATEGORIES } from '../model/types'

export interface RecurringFormFieldsProps {
  form: UseFormReturn<RecurringFormInput>
  isDisabled?: boolean
}

const DAYS = Array.from({ length: 28 }, (_, index) => String(index + 1))

/** A recurring template's writable fields. Passive — the feature owns the mutation (§3.2). */
export function RecurringFormFields({ form, isDisabled = false }: RecurringFormFieldsProps) {
  const { t } = useTranslation(['expenses', 'validation'])

  const message = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const errors = form.formState.errors

  return (
    <div className="flex flex-col gap-4">
      <Field
        description={t('expenses:recurring.form.nameHint')}
        error={message(errors.name?.message)}
        isRequired
        label={t('expenses:recurring.form.name')}
      >
        <Input autoComplete="off" disabled={isDisabled} {...form.register('name')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          description={t('expenses:recurring.form.amountHint')}
          error={message(errors.amount?.message)}
          isRequired
          label={t('expenses:form.amount')}
        >
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

        <Field
          description={t('expenses:recurring.form.dayHint')}
          error={message(errors.dayOfMonth?.message)}
          isRequired
          label={t('expenses:recurring.form.day')}
        >
          <Controller
            control={form.control}
            name="dayOfMonth"
            render={({ field }) => (
              <Select
                disabled={isDisabled}
                name={field.name}
                onValueChange={field.onChange}
                options={DAYS.map((value) => ({ value, label: value }))}
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
                options={RECURRING_CATEGORIES.map((value) => ({
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

      <Field
        description={t('expenses:form.payeeHint')}
        error={message(errors.payee?.message)}
        label={t('expenses:form.payee')}
      >
        <Input autoComplete="off" disabled={isDisabled} {...form.register('payee')} />
      </Field>
    </div>
  )
}
