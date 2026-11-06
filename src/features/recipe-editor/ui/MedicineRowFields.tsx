import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DOSE_FORMS,
  type DoseForm,
  DURATION_UNITS,
  type DurationUnit,
  FREQUENCIES,
  type Frequency,
  MEAL_RELATIONS,
  type MealRelation,
} from '@/entities/recipe'
import { Button, Input, Select } from '@/shared/ui'
import { fillFromCatalog } from '../model/payload'
import type { MedicineRow } from '../model/types'
import { MedicineCombobox } from './MedicineCombobox'

export interface MedicineRowFieldsProps {
  row: MedicineRow
  /** 1-based, shown in the "#" column. */
  position: number
  /** Opens the name picker on mount — set for a row the user just added. */
  isNew: boolean
  onChange: (row: MedicineRow) => void
  onRemove: () => void
}

/** Integers only — the server refuses anything else for dose and duration. */
const digitsOnly = (value: string) => value.replace(/\D/g, '')

const numberInputClass = 'w-14 shrink-0 text-center'

/** One medicine as a table row; each control is named by `aria-label`, the header is visual. */
export function MedicineRowFields({
  row,
  position,
  isNew,
  onChange,
  onRemove,
}: MedicineRowFieldsProps) {
  const { t } = useTranslation('recipes')
  const update = (changes: Partial<MedicineRow>) => onChange({ ...row, ...changes })

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 text-center text-callout text-text-secondary">{position}</td>
      <td className="px-2 py-2">
        <MedicineCombobox
          aria-label={t('editor.nameLabel')}
          defaultOpen={isNew}
          onCustom={(name) => update({ name })}
          onPick={(medicine) => onChange(fillFromCatalog(row, medicine))}
          value={row.name}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-2">
          <Input
            aria-label={t('editor.doseLabel')}
            className={numberInputClass}
            inputMode="numeric"
            onChange={(event) => update({ dose: digitsOnly(event.target.value) })}
            size="sm"
            value={row.dose}
          />
          <Select
            aria-label={t('editor.formLabel')}
            onValueChange={(value) => update({ form: value as DoseForm })}
            options={DOSE_FORMS.map((form) => ({ value: form, label: t(`doseFormName.${form}`) }))}
            size="sm"
            value={row.form}
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <Select
          aria-label={t('editor.frequencyLabel')}
          onValueChange={(value) => update({ frequency: value as Frequency })}
          options={FREQUENCIES.map((frequency) => ({
            value: frequency,
            label: t(`frequency.${frequency}`),
          }))}
          size="sm"
          value={row.frequency}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-2">
          <Input
            aria-label={t('editor.durationLabel')}
            className={numberInputClass}
            inputMode="numeric"
            onChange={(event) => update({ durationAmount: digitsOnly(event.target.value) })}
            size="sm"
            value={row.durationAmount}
          />
          <Select
            aria-label={t('editor.unitLabel')}
            onValueChange={(value) => update({ durationUnit: value as DurationUnit })}
            options={DURATION_UNITS.map((unit) => ({
              value: unit,
              label: t(`durationUnit.${unit}`),
            }))}
            size="sm"
            value={row.durationUnit}
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <Select
          aria-label={t('editor.mealLabel')}
          onValueChange={(value) => update({ meal: value as MealRelation })}
          options={MEAL_RELATIONS.map((meal) => ({ value: meal, label: t(`meal.${meal}`) }))}
          size="sm"
          value={row.meal}
        />
      </td>
      <td className="px-2 py-2">
        <Button
          aria-label={
            row.name === ''
              ? t('editor.removeMedicine')
              : t('editor.removeNamedMedicine', { name: row.name })
          }
          iconLeft={<Trash2 aria-hidden="true" className="size-4" />}
          onClick={onRemove}
          size="sm"
          variant="ghost"
        />
      </td>
    </tr>
  )
}
