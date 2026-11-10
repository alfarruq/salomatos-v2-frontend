import { valibotResolver } from '@hookform/resolvers/valibot'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  BranchFormFields,
  type BranchFormInput,
  branchFormFieldOf,
  branchFormSchema,
  emptyBranchForm,
} from '@/entities/branch'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Checkbox, Dialog } from '@/shared/ui'
import { useCreateBranch } from '../model/useCreateBranch'

export interface CreateBranchDialogProps {
  clinicId: string
  /** The branch the owner is working in; its price list is offered for copying. */
  currentBranch: { id: string; name: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'create-branch-form'

export function CreateBranchDialog({
  clinicId,
  currentBranch,
  open,
  onOpenChange,
}: CreateBranchDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  // On by default: a branch with an empty price list cannot bill anything.
  const [copyCatalog, setCopyCatalog] = useState(true)

  const form = useForm<BranchFormInput>({
    resolver: valibotResolver(branchFormSchema),
    mode: 'onBlur',
    defaultValues: emptyBranchForm,
  })

  const { mutate, isPending } = useCreateBranch(clinicId)

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      { form: values, copyCatalogFrom: copyCatalog ? currentBranch.id : null },
      {
        onSuccess: () => {
          form.reset(emptyBranchForm)
          setCopyCatalog(true)
          onOpenChange(false)
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('admin:branch.createFailed') })
            return
          }
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            const first = messages[0]
            if (first === undefined) continue
            form.setError(branchFormFieldOf(field), { message: first })
          }
          if (Object.keys(error.fieldErrors).length === 0) {
            form.setError('root', {
              message:
                error.kind === 'network'
                  ? t('common:error.network')
                  : t('admin:branch.createFailed'),
            })
          }
        },
      },
    ),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      description={t('admin:branch.createDescription')}
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('admin:branch.create')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:branch.createTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <BranchFormFields form={form} isDisabled={isPending} />
        <Checkbox
          checked={copyCatalog}
          disabled={isPending}
          label={t('admin:branch.copyCatalog', { name: currentBranch.name })}
          onCheckedChange={(checked) => setCopyCatalog(checked === true)}
        />
      </form>
    </Dialog>
  )
}
