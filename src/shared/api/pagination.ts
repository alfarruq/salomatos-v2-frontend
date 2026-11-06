import * as v from 'valibot'

/**
 * DRF's `PageNumberPagination` envelope.
 *
 * §5.4 asks for `CursorPagination` and gives a good reason: `OFFSET 50000` on a
 * thousand clinics' patient tables is how PostgreSQL is brought down. This
 * backend configures `PageNumberPagination` with `page_size = 20`
 * (`apps/core/pagination.py`), so that is what the client reads.
 *
 * One thing genuinely improves as a result: `count` exists. Cursor pagination
 * cannot report a total, which is why `shared/ui/Pagination` was built without
 * numbered pages. With a count, "47 patients" and a last page are both
 * expressible.
 *
 * ⚠️ And one thing gets worse, which the list screens have to allow for: page
 * numbers are only stable if the ordering is. `CreatedUpdatedAbstractModel`
 * orders by `-created_at` and that column is nullable, so rows with a null can
 * shuffle between requests and appear twice or not at all. Nothing the client
 * can fix; worth knowing before trusting a page boundary.
 */
export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** Wraps an item schema in the envelope, so each entity declares only its row. */
export function pageSchema<TSchema extends v.GenericSchema>(item: TSchema) {
  return v.object({
    count: v.number(),
    next: v.nullable(v.string()),
    previous: v.nullable(v.string()),
    results: v.array(item),
  })
}

/** `next`'s own origin and `/api` prefix, which `httpClient` adds back itself. */
export function pathFromNext(next: string): string {
  const url = new URL(next, globalThis.location.origin)
  return `${url.pathname.replace(/^\/api\//, '')}${url.search}`
}

/** Page size is the server's; this mirrors `PAGE_SIZE` so callers can do arithmetic. */
export const PAGE_SIZE = 20

export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size))
}

/**
 * Reads every page of a short list (staff, specialties, the price list) for a
 * picker. Not for patients or anything else that grows without bound.
 */
export async function fetchAllPages<TSchema extends v.GenericSchema>(
  firstPath: string,
  item: TSchema,
  fetchPage: (path: string) => Promise<unknown>,
): Promise<v.InferOutput<TSchema>[]> {
  const schema = pageSchema(item)
  const rows: v.InferOutput<TSchema>[] = []
  let path: string | null = firstPath
  while (path !== null) {
    const page: v.InferOutput<typeof schema> = v.parse(schema, await fetchPage(path))
    rows.push(...page.results)
    path = page.next === null ? null : pathFromNext(page.next)
  }
  return rows
}
