import { useTranslation } from 'react-i18next'
import type { Recipe } from '@/entities/recipe'
import { ApiError } from '@/shared/api/errors'
import { Alert, Button, Dialog, toast } from '@/shared/ui'
import { useDeleteRecipe } from '../model/useDeleteRecipe'

export interface DeleteRecipeDialogProps {
  clinicId: string
  recipe: Recipe
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteRecipeDialog({
  clinicId,
  recipe,
  open,
  onOpenChange,
}: DeleteRecipeDialogProps) {
  const { t } = useTranslation(['recipes', 'common'])
  const { mutate, isPending, error, reset } = useDeleteRecipe(clinicId)

  const errorMessage =
    error === null
      ? null
      : error instanceof ApiError && error.kind === 'network'
        ? t('common:error.network')
        : t('recipes:delete.failed')

  return (
    <Dialog
      description={t('recipes:delete.description')}
      footer={
        <>
          <Button
            disabled={isPending}
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
            variant="secondary"
          >
            {t('common:action.cancel')}
          </Button>
          <Button
            isLoading={isPending}
            onClick={() =>
              mutate(recipe.id, {
                onSuccess: () => {
                  toast.success(t('recipes:delete.done'))
                  onOpenChange(false)
                },
              })
            }
            variant="danger"
          >
            {t('common:action.delete')}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t('recipes:delete.title')}
    >
      {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
    </Dialog>
  )
}
