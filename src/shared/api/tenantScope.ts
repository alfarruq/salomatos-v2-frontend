/**
 * Which tenant the next request is for. Read by `httpClient` and sent as a
 * header; the backend checks it against the caller's memberships.
 *
 * - `clinic`: one branch. Every read and write.
 * - `organization`: every branch of an organization the user owns. Read-only on
 *   the server, so the UI drops write permissions in this mode.
 *
 * RAM only, like the token's in-memory copy: it holds no secret, but persisting
 * it would need a new storage key (CLAUDE.md §3 allowlist). After a reload the
 * session falls back to the first clinic.
 */
export type TenantScope = { kind: 'clinic'; id: string } | { kind: 'organization'; id: string }

let scope: TenantScope | null = null

export function setTenantScope(next: TenantScope | null): void {
  scope = next
}

export function getTenantScope(): TenantScope | null {
  return scope
}

/** The value every query key is scoped by (§6.2). Distinct for the two modes. */
export function tenantScopeKey(value: TenantScope): string {
  return value.kind === 'clinic' ? `clinic:${value.id}` : `organization:${value.id}`
}
