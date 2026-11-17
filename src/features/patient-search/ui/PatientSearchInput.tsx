import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input, type InputSize } from '@/shared/ui'

export interface PatientSearchInputProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  /** `md` where the box sits beside full-size buttons, so their heights line up. */
  size?: InputSize
}

/**
 * The search box for the patient list.
 *
 * `type="search"` rather than `type="text"`: it gets the right on-screen
 * keyboard on the tablet at the reception desk, and screen readers announce it
 * as a search field.
 *
 * ⛔ No `name`, and the surrounding markup is not a `<form>`. A named input
 * inside a form is offered to the browser's autofill store, which would keep
 * patient names on a shared machine long after the shift ended (§13.4).
 */
export function PatientSearchInput({
  value,
  onChange,
  onClear,
  size = 'sm',
}: PatientSearchInputProps) {
  const { t } = useTranslation('patients')

  return (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary"
      />
      <Input
        aria-label={t('search.label')}
        autoComplete="off"
        className="pr-9 pl-9"
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('search.placeholder')}
        size={size}
        type="search"
        value={value}
      />
      {value === '' ? null : (
        <button
          aria-label={t('search.clear')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-control p-1 text-text-tertiary hover:text-text"
          onClick={onClear}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}
