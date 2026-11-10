import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  type Branch,
  BranchFormFields,
  type BranchFormInput,
  branchFormFieldOf,
  branchFormSchema,
  toBranchForm,
} from '@/entities/branch'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog } from '@/shared/ui'
import { useUpdateBranch } from '../model/useUpdateBranch'

export interface EditBranchDialogProps {
  clinicId: string
  branch: Branch
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORM_ID = 'edit-branch-form'

export function EditBranchDialog({ clinicId, branch, open, onOpenChange }: EditBranchDialogProps) {
  const { t } = useTranslation(['admin', 'common'])

  const form = useForm<BranchFormInput>({
    resolver: valibotResolver(branchFormSchema),
    mode: 'onBlur',
    defaultValues: toBranchForm(branch),
  })

  const { reset } = form
  // `defaultValues` is read once; without this the dialog would rename the first branch it opened for.
  useEffect(() => {
    if (open) reset(toBranchForm(branch))
  }, [open, branch, reset])

  const { mutate, isPending } = useUpdateBranch(clinicId)

  const handleSubmit = form.handleSubmit((values) =>
    mutate(
      { branchId: branch.id, input: values },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (!(error instanceof ApiError)) {
            form.setError('root', { message: t('admin:branch.saveFailed') })
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
                error.kind === 'network' ? t('common:error.network') : t('admin:branch.saveFailed'),
            })
          }
        },
      },
    ),
  )

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog
      footer={
        <>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common:action.cancel')}
          </Button>
          <Button form={FORM_ID} isLoading={isPending} type="submit" variant="primary">
            {t('common:action.save')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('admin:branch.editTitle')}
    >
      <form className="flex flex-col gap-4" id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {rootError ? <Alert title={rootError} tone="danger" /> : null}
        <BranchFormFields form={form} isDisabled={isPending} />
      </form>
    </Dialog>
  )
}
