import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultPatientFilters, patientQueries } from '@/entities/patient'
import { useDebounce } from '@/shared/lib/useDebounce'
import { Button, Field, Input } from '@/shared/ui'

const PATIENT_SEARCH_DEBOUNCE_MS = 300

export interface PickedPatient {
  id: string
  fullName: string
  phoneNumber: string | null
}

export interface PatientPickerProps {
  clinicId: string
  value: PickedPatient | null
  onChange: (patient: PickedPatient | null) => void
  isDisabled?: boolean
}

/**
 * Finds an existing patient by name for a treatment started outside the
 * patient's own page. Same pattern as the appointment dialog's picker, kept
 * local because §4 forbids importing `features/patient-search` here.
 *
 * The term lives in `useState` only — a patient's name never reaches the URL
 * (§3). No `name` attribute, so the browser does not offer it to autofill.
 */
export function PatientPicker({
  clinicId,
  value,
  onChange,
  isDisabled = false,
}: PatientPickerProps) {
  const { t } = useTranslation('treatments')
  const [term, setTerm] = useState('')
  const debouncedTerm = useDebounce(term.trim(), PATIENT_SEARCH_DEBOUNCE_MS)

  const patientsQuery = useQuery({
    ...patientQueries.list(clinicId, { ...defaultPatientFilters, search: debouncedTerm }),
    enabled: value === null && debouncedTerm !== '',
  })
  const results = patientsQuery.data?.results ?? []

  if (value !== null) {
    return (
      <Field label={t('composer.patientLabel')} isRequired>
        <div className="flex items-center gap-2 rounded-control border border-border px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body text-text">{value.fullName}</span>
            {value.phoneNumber === null ? null : (
              <span className="text-caption text-text-secondary">{value.phoneNumber}</span>
            )}
          </div>
          <Button
            aria-label={t('composer.patientClear')}
            disabled={isDisabled}
            onClick={() => {
              setTerm('')
              onChange(null)
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </Field>
    )
  }

  const showNoResults =
    debouncedTerm !== '' &&
    patientsQuery.isSuccess &&
    results.length === 0 &&
    !patientsQuery.isFetching

  return (
    <Field
      description={showNoResults ? t('composer.patientNoResults') : undefined}
      isRequired
      label={t('composer.patientLabel')}
    >
      <div className="flex flex-col gap-2">
        <Input
          autoComplete="off"
          disabled={isDisabled}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t('composer.patientPlaceholder')}
          type="search"
          value={term}
        />
        {debouncedTerm === '' || results.length === 0 ? null : (
          <ul className="flex flex-col gap-1 rounded-control border border-border bg-elevated p-1">
            {results.map((patient) => (
              <li key={patient.id}>
                <button
                  className="flex w-full flex-col rounded-[8px] px-3 py-2 text-left hover:bg-sunken"
                  onClick={() =>
                    onChange({
                      id: patient.id,
                      fullName: patient.fullName,
                      phoneNumber: patient.phoneNumber,
                    })
                  }
                  type="button"
                >
                  <span className="text-body text-text">{patient.fullName}</span>
                  {patient.phoneNumber === null ? null : (
                    <span className="text-caption text-text-secondary">{patient.phoneNumber}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  )
}
