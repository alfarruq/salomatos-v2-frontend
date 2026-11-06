import * as v from 'valibot'
import { type TenantScope, tenantScopeKey } from '@/shared/api/tenantScope'
import { readOnly } from './permissions'
import { type ClinicMembership, PERMISSIONS, type Permission, type Session } from './types'

/** The wire contract for `GET /api/v1/auth/me/`, validated at runtime (ADR-006). */
const optionalString = v.optional(v.nullable(v.string()), null)

const membershipSchema = v.object({
  id: v.string(),
  clinic: v.object({ id: v.string(), name: v.string() }),
  role: v.picklist(['owner', 'admin', 'doctor']),
  permissions: v.array(v.string()),
})

export const meResponseSchema = v.object({
  id: v.string(),
  username: v.string(),
  full_name: v.pipe(v.string(), v.minLength(1)),
  phone_number: optionalString,
  email: optionalString,
  memberships: v.array(membershipSchema),
  organizations: v.optional(v.array(v.object({ id: v.string(), name: v.string() })), []),
})

export type MeResponse = v.InferOutput<typeof meResponseSchema>

const KNOWN = new Set<string>(PERMISSIONS)

function toPermissions(values: readonly string[]): ReadonlySet<Permission> {
  return new Set(values.filter((value): value is Permission => KNOWN.has(value)))
}

/**
 * Maps the wire shape to the session, resolving the requested scope.
 *
 * A scope the user no longer has (removed from a clinic, lost ownership) falls
 * back to the first clinic instead of failing, so a stale choice cannot lock
 * anyone out. Null means the user belongs to no active clinic.
 */
export function toSession(response: MeResponse, requested: TenantScope | null): Session | null {
  const memberships: ClinicMembership[] = response.memberships.map((m) => ({
    id: m.id,
    clinicId: m.clinic.id,
    clinicName: m.clinic.name,
    role: m.role,
    permissions: toPermissions(m.permissions),
  }))
  const first = memberships[0]
  if (first === undefined) return null

  const base = {
    userId: response.id,
    username: response.username,
    fullName: response.full_name,
    phoneNumber: response.phone_number === '' ? null : response.phone_number,
    email: response.email === '' ? null : response.email,
    memberships,
    organizations: response.organizations,
  }

  if (requested?.kind === 'organization') {
    const organization = response.organizations.find((o) => o.id === requested.id)
    const ownerMembership = memberships.find((m) => m.role === 'owner')
    if (organization !== undefined && ownerMembership !== undefined) {
      return {
        ...base,
        scope: requested,
        clinicId: tenantScopeKey(requested),
        scopeName: organization.name,
        isAllBranches: true,
        role: 'owner',
        membershipId: null,
        permissions: readOnly(ownerMembership.permissions),
      }
    }
  }

  const active =
    (requested?.kind === 'clinic' && memberships.find((m) => m.clinicId === requested.id)) || first
  const scope: TenantScope = { kind: 'clinic', id: active.clinicId }
  return {
    ...base,
    scope,
    clinicId: tenantScopeKey(scope),
    scopeName: active.clinicName,
    isAllBranches: false,
    role: active.role,
    membershipId: active.id,
    permissions: active.permissions,
  }
}

export function parseSession(raw: unknown, requested: TenantScope | null): Session | null {
  return toSession(v.parse(meResponseSchema, raw), requested)
}
