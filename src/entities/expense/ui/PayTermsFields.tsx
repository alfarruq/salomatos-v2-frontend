import { useTranslation } from 'react-i18next'
import { Field, Input, MoneyInput, Select, Switch } from '@/shared/ui'
import type { PayTermsInput } from '../model/formSchema'
import { COMPENSATION_BASES } from '../model/types'

export interface PayTermsFieldsProps {
  value: PayTermsInput
  onChange: (next: PayTermsInput) => void
  /** Already translated, as `Field` expects. */
  errors?: { percent?: string | undefined; fixed?: string | undefined }
  isDisabled?: boolean
  /** Hiring may leave both off ("agree later"); changing terms may not. */
  allowNone?: boolean
}

/**
 * The salary / percent / both choice, as two switches.
 *
 * Controlled rather than bound to a form, so the add-doctor form and the
 * change-terms dialog can each keep it under their own field name.
 */
export function PayTermsFields({
  value,
  onChange,
  errors = {},
  isDisabled = false,
  allowNone = false,
}: PayTermsFieldsProps) {
  const { t } = useTranslation('expenses')
  const set = (patch: Partial<PayTermsInput>) => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Switch
          checked={value.fixedOn}
          disabled={isDisabled}
          label={t('payroll.terms.salaryOn')}
          onCheckedChange={(fixedOn) => set({ fixedOn })}
        />
        {value.fixedOn ? (
          <Field error={errors.fixed} isRequired label={t('payroll.terms.fixedLabel')}>
            <MoneyInput
              disabled={isDisabled}
              name="fixed"
              onChange={(fixed) => set({ fixed })}
              placeholder="0"
              value={value.fixed}
            />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Switch
          checked={value.percentOn}
          disabled={isDisabled}
          label={t('payroll.terms.percentOn')}
          onCheckedChange={(percentOn) => set({ percentOn })}
        />
        {value.percentOn ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              description={t('payroll.terms.percentHint')}
              error={errors.percent}
              isRequired
              label={t('payroll.terms.percentLabel')}
            >
              <Input
                autoComplete="off"
                disabled={isDisabled}
                inputMode="decimal"
                name="percent"
                onChange={(event) => set({ percent: event.target.value })}
                placeholder="50"
                value={value.percent}
              />
            </Field>
            <Field isRequired label={t('payroll.terms.base')}>
              <Select
                disabled={isDisabled}
                name="base"
                onValueChange={(base) => {
                  const picked = COMPENSATION_BASES.find((option) => option === base)
                  if (picked !== undefined) set({ base: picked })
                }}
                options={COMPENSATION_BASES.map((option) => ({
                  value: option,
                  label: t(`payroll.terms.bases.${option}`),
                }))}
                value={value.base}
              />
            </Field>
          </div>
        ) : null}
      </div>

      {/* Both off is allowed when hiring: say what it means instead of leaving a silent gap. */}
      {allowNone && !value.fixedOn && !value.percentOn ? (
        <p className="text-caption text-text-secondary">{t('payroll.terms.noneYet')}</p>
      ) : null}
    </div>
  )
}
