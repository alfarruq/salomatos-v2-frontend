import { useQuery } from '@tanstack/react-query'
import { Pencil, Pill, Printer, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDosage, type Recipe, recipeQueries, type Translate } from '@/entities/recipe'
import { Can } from '@/entities/session'
import { formatFixedDate } from '@/shared/lib/calendarDate'
import { clinicDayOf } from '@/shared/lib/datetime'
import { Badge, Button, Card, EmptyState, ErrorState, QueryBoundary, Skeleton } from '@/shared/ui'

export interface PrescriptionCardsProps {
  clinicId: string
  patientId: string
  onCreate: () => void
  onEdit: (recipe: Recipe) => void
  onDelete: (recipe: Recipe) => void
  onPrint: (recipe: Recipe) => void
}

/** Newest first, by the server's own `created_at`; a row without one sinks. */
function newestFirst(recipes: Recipe[]): Recipe[] {
  const time = (recipe: Recipe) =>
    recipe.createdAt === null ? Number.NEGATIVE_INFINITY : Date.parse(recipe.createdAt)
  return [...recipes].sort((a, b) => time(b) - time(a))
}

/**
 * The patient's prescriptions as cards, with the actions that manage them.
 * Cards rather than a table: a prescription is a short document — medicines
 * plus a note — not a row of comparable figures.
 */
export function PrescriptionCards({
  clinicId,
  patientId,
  onCreate,
  onEdit,
  onDelete,
  onPrint,
}: PrescriptionCardsProps) {
  const { t } = useTranslation(['recipes', 'patients', 'common'])
  const query = useQuery(recipeQueries.list(clinicId, patientId))

  const writeButton = (
    <Button
      iconLeft={<Pill aria-hidden="true" className="size-4" />}
      onClick={onCreate}
      size="sm"
      variant="primary"
    >
      {t('patients:detail.writePrescription')}
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title2 text-text">{t('patients:detail.tabPrescriptions')}</h2>
        {writeButton}
      </div>

      <QueryBoundary
        empty={
          <EmptyState
            action={writeButton}
            description={t('patients:detail.prescriptionsEmptyDescription')}
            headingLevel={3}
            icon={<Pill aria-hidden="true" className="size-8" />}
            title={t('patients:detail.prescriptionsEmpty')}
          />
        }
        error={({ retry }) => (
          <ErrorState
            description={t('common:error.pageBody')}
            retryLabel={t('common:action.retry')}
            title={t('common:error.pageTitle')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        )}
        loading={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
        query={query}
      >
        {(recipes) => (
          <div className="flex flex-col gap-4">
            {newestFirst(recipes).map((recipe) => (
              <RecipeCard
                key={recipe.id}
                onDelete={() => onDelete(recipe)}
                onEdit={() => onEdit(recipe)}
                onPrint={() => onPrint(recipe)}
                recipe={recipe}
              />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}

function RecipeCard({
  recipe,
  onEdit,
  onDelete,
  onPrint,
}: {
  recipe: Recipe
  onEdit: () => void
  onDelete: () => void
  onPrint: () => void
}) {
  const { t } = useTranslation(['recipes', 'common'])
  const translate: Translate = (key, options) => (options === undefined ? t(key) : t(key, options))

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {recipe.createdAt === null ? null : (
            <span className="text-callout font-medium text-text">
              {formatFixedDate(clinicDayOf(recipe.createdAt))}
            </span>
          )}
          <Badge>{t('recipes:list.medicineCount', { count: recipe.medicines.length })}</Badge>
        </div>
        {recipe.doctorName === null ? null : <Badge tone="accent">{recipe.doctorName}</Badge>}
      </div>

      {recipe.medicines.length === 0 ? null : (
        <ul className="flex flex-wrap gap-2">
          {recipe.medicines.map((medicine) => {
            const dosage = formatDosage(medicine, translate)
            return (
              <li
                className="rounded-full border border-border bg-sunken px-3 py-1 text-caption text-text"
                key={medicine.id}
              >
                {[medicine.name ?? '—', dosage].filter(Boolean).join(' · ')}
              </li>
            )
          })}
        </ul>
      )}

      {recipe.notes === null || recipe.notes === '' ? null : (
        <p className="text-caption italic text-text-secondary">{recipe.notes}</p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Can permission="prescription:manage">
          <Button
            iconLeft={<Pencil aria-hidden="true" className="size-4" />}
            onClick={onEdit}
            size="sm"
            variant="secondary"
          >
            {t('common:action.edit')}
          </Button>
          <Button
            iconLeft={<Trash2 aria-hidden="true" className="size-4" />}
            onClick={onDelete}
            size="sm"
            variant="danger"
          >
            {t('common:action.delete')}
          </Button>
        </Can>
        <Button
          iconLeft={<Printer aria-hidden="true" className="size-4" />}
          onClick={onPrint}
          size="sm"
          variant="secondary"
        >
          {t('recipes:list.print')}
        </Button>
      </div>
    </Card>
  )
}
