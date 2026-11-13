import { X } from 'lucide-react'
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Button,
  DatePicker,
  Field,
  Input,
  PhoneInput,
  Select,
  type SelectOption,
  Textarea,
} from '@/shared/ui'
import type { AppointmentFormInput } from '../model/formSchema'
import { APPOINTMENT_STATUSES } from '../model/types'

/** Bookable slots, 30 minutes apart, 07:00 through 20:00. */
const APPOINTMENT_TIME_OPTIONS: SelectOption[] = (() => {
  const options: SelectOption[] = []
  for (let hour = 7; hour <= 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 20 && minute > 0) break
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      options.push({ value: time, label: time })
    }
  }
  return options
})()

const DURATION_OPTIONS: SelectOption[] = [15, 30, 45, 60, 90, 120, 180].map((minutes) => ({
  value: String(minutes),
  label: String(minutes),
}))

export interface AppointmentTreatmentTypeProps {
  /** Services from the price list, already as `{value, label}` — the entity cannot see them (§4). */
  options: SelectOption[]
  /** Shown instead of the select when there is nothing to pick from yet. */
  emptyHint: string | null
  /** Called with a picked service id, so the feature can set the visit length from it. */
  onPick?: (serviceId: string) => void
}

export interface AppointmentPatientResult {
  id: string
  fullName: string
  phoneNumber: string | null
}

export interface AppointmentPatientPickerProps {
  searchTerm: string
  onSearchTermChange: (term: string) => void
  results: AppointmentPatientResult[]
  /** Null when nothing is linked yet. */
  linkedPatientName: string | null
  onSelect: (patient: AppointmentPatientResult) => void
  onUnlink: () => void
}

export interface AppointmentFormFieldsProps {
  form: UseFormReturn<AppointmentFormInput>
  isDisabled?: boolean
  /**
   * Doctor choices, as plain `{value, label}` pairs — an entity may not import
   * another entity (§4), so the feature fetching the list converts it first,
   * same as `DoctorFormFields.doctorTypeOptions`.
   */
  doctorOptions: SelectOption[]
  /** A fresh appointment always starts `scheduled` — only edit shows this. */
  showStatus?: boolean
  patientPicker: AppointmentPatientPickerProps
  /** Absent hides the service select. */
  treatmentType?: AppointmentTreatmentTypeProps
  /**
   * Lets a typed name with no picked patient be booked as someone new: a phone
   * field appears under it. Only a new booking — the server refuses it on edit.
   */
  allowNewPatient?: boolean
}

/**
 * An appointment's writable fields. Passive — the feature owns the mutation
 * and the patient search it drives (§3.2).
 */
export function AppointmentFormFields({
  form,
  isDisabled = false,
  doctorOptions,
  showStatus = false,
  patientPicker,
  treatmentType,
  allowNewPatient = false,
}: AppointmentFormFieldsProps) {
  const { t } = useTranslation(['appointments', 'validation'])

  const message = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined
    return value.startsWith('validation.') ? t(value.replace('validation.', 'validation:')) : value
  }

  const errors = form.formState.errors
  const typedName = useWatch({ control: form.control, name: 'fullName' })
  const isNewPatient =
    allowNewPatient && patientPicker.linkedPatientName === null && typedName.trim() !== ''

  return (
    <div className="flex flex-col gap-4">
      {/*
       * The input is the search box; picking a result links that patient.
       * Typing again unlinks them, so the name shown never disagrees with the
       * record the visit is booked for.
       */}
      <Field
        description={
          patientPicker.linkedPatientName === null
            ? undefined
            : t('appointments:form.fullNameLinkedHint')
        }
        error={message(errors.patientId?.message ?? errors.fullName?.message)}
        isRequired
        label={t('appointments:form.patient')}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <Input
                  autoComplete="off"
                  className="flex-1"
                  disabled={isDisabled}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    const value = event.target.value
                    field.onChange(value)
                    if (patientPicker.linkedPatientName !== null) patientPicker.onUnlink()
                    patientPicker.onSearchTermChange(value.trim())
                  }}
                  placeholder={t('appointments:form.patientSearchPlaceholder')}
                  ref={field.ref}
                  value={field.value}
                />
              )}
            />
            {patientPicker.linkedPatientName === null ? null : (
              <Button
                aria-label={t('appointments:form.unlinkPatient')}
                disabled={isDisabled}
                onClick={patientPicker.onUnlink}
                size="sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            )}
          </div>
          {patientPicker.searchTerm === '' || patientPicker.results.length === 0 ? null : (
            <ul className="flex flex-col gap-1 rounded-control border border-border bg-elevated p-1">
              {patientPicker.results.map((result) => (
                <li key={result.id}>
                  <button
                    className="flex w-full flex-col rounded-[8px] px-3 py-2 text-left hover:bg-sunken"
                    onClick={() => patientPicker.onSelect(result)}
                    type="button"
                  >
                    <span className="text-body text-text">{result.fullName}</span>
                    {result.phoneNumber === null ? null : (
                      <span className="text-caption text-text-secondary">{result.phoneNumber}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      {isNewPatient ? (
        <Field
          description={t('appointments:form.newPatientHint')}
          error={message(errors.phoneNumber?.message)}
          isRequired
          label={t('appointments:form.newPatientPhone')}
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
      ) : null}

      <Field
        error={message(errors.doctorId?.message)}
        isRequired
        label={t('appointments:form.doctor')}
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
              placeholder={t('appointments:form.doctorPlaceholder')}
              value={field.value}
            />
          )}
        />
      </Field>

      {treatmentType === undefined ? null : (
        <Field
          description={treatmentType.emptyHint ?? undefined}
          error={message(errors.serviceId?.message)}
          label={t('appointments:form.treatmentType')}
        >
          <Controller
            control={form.control}
            name="serviceId"
            render={({ field }) => (
              <Select
                disabled={isDisabled || treatmentType.options.length === 0}
                name={field.name}
                onValueChange={(value) => {
                  field.onChange(value)
                  treatmentType.onPick?.(value)
                }}
                options={treatmentType.options}
                placeholder={t('appointments:form.treatmentTypePlaceholder')}
                value={field.value}
              />
            )}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field error={message(errors.date?.message)} isRequired label={t('appointments:form.date')}>
          <Controller
            control={form.control}
            name="date"
            render={({ field }) => (
              <DatePicker
                disabled={isDisabled}
                nextMonthLabel={t('appointments:form.nextMonth')}
                onChange={field.onChange}
                placeholder={t('appointments:form.datePlaceholder')}
                previousMonthLabel={t('appointments:form.previousMonth')}
                value={field.value}
              />
            )}
          />
        </Field>

        <Field error={message(errors.time?.message)} isRequired label={t('appointments:form.time')}>
          <Controller
            control={form.control}
            name="time"
            render={({ field }) => (
              <Select
                disabled={isDisabled}
                name={field.name}
                onValueChange={field.onChange}
                options={APPOINTMENT_TIME_OPTIONS}
                placeholder={t('appointments:form.time')}
                value={field.value}
              />
            )}
          />
        </Field>
      </div>

      <Field
        error={message(errors.durationMinutes?.message)}
        label={t('appointments:form.duration')}
      >
        <Controller
          control={form.control}
          name="durationMinutes"
          render={({ field }) => (
            <Select
              disabled={isDisabled}
              name={field.name}
              onValueChange={field.onChange}
              options={DURATION_OPTIONS}
              value={field.value}
            />
          )}
        />
      </Field>

      {showStatus ? (
        <Field label={t('appointments:form.status')}>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                disabled={isDisabled}
                name={field.name}
                onValueChange={field.onChange}
                options={APPOINTMENT_STATUSES.map((status) => ({
                  value: status,
                  label: t(`appointments:status.${status}`),
                }))}
                value={field.value}
              />
            )}
          />
        </Field>
      ) : null}

      <Field error={message(errors.notes?.message)} label={t('appointments:form.notes')}>
        <Textarea disabled={isDisabled} {...form.register('notes')} />
      </Field>
    </div>
  )
}
