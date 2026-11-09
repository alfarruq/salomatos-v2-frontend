import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchRecipePdf } from '@/entities/recipe'
import { ApiError } from '@/shared/api/errors'
import { toast } from '@/shared/ui'

/** Long enough for the new tab to load the file; the URL is useless after that. */
const REVOKE_AFTER_MS = 60_000

async function printRecipe(recipeId: string): Promise<void> {
  // Opened before the request: a tab opened after an `await` is a popup the
  // browser blocks, since it no longer follows the click.
  const tab = window.open('', '_blank')
  if (tab !== null) tab.opener = null
  try {
    const url = URL.createObjectURL(await fetchRecipePdf(recipeId))
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
    if (tab !== null) {
      tab.location.href = url
      return
    }
    // Popups blocked: save the file instead. The name carries the id only.
    const link = document.createElement('a')
    link.href = url
    link.download = `prescription-${recipeId}.pdf`
    link.click()
  } catch (error) {
    tab?.close()
    throw error
  }
}

/** Opens the server-made PDF in a new tab, where the browser prints it. */
export function usePrintRecipe() {
  const { t } = useTranslation(['recipes', 'common'])
  return useMutation({
    mutationFn: printRecipe,
    retry: false,
    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.kind === 'network'
          ? t('common:error.network')
          : t('recipes:print.failed'),
      )
    },
  })
}
