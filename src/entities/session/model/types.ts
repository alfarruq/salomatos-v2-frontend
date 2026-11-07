import type { TenantScope } from '@/shared/api/tenantScope'

/**
 * Permissions the UI gates on (§9.2). The strings are the backend's
 * (`apps/tenancy/permissions.py`) and arrive from `/api/v1/auth/me/`; a closed
 * union so a typo in `<Can permission=…>` is a type error. Unknown strings
 * from the server are dropped, not trusted.
 */
export const PERMISSIONS = [
  'clinic:view',
  'clinic:manage',
  'staff:view',
  'staff:manage',
  'staff:manage_owners',
  'specialty:manage',
  'patient:view',
  'patient:view_all',
  'patient:manage',
  'patient:archive',
  'patient:bot_access',
  'appointment:view',
  'appointment:view_all',
  'appointment:manage',
  'chair:manage',
  'service:view',
  'service:manage',
  'prescription:view',
  'prescription:manage',
  'attachment:view',
  'attachment:manage',
  'chart:view',
  'chart:manage',
  'plan:view',
  'plan:manage',
  'procedure:view',
  'procedure:manage',
  'procedure:void',
  'payment:view',
  'payment:manage',
  'payment:void',
  'report:view',
  'statistics:view',
  'statistics:view_all',
  'expense:view',
  'expense:manage',
  'expense:void',
  'payroll:view',
  'payroll:manage',
  'payroll:view_own',
  'audit:view',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** `Membership.Role` on the backend. Patients never sign in here. */
export type Role = 'owner' | 'admin' | 'doctor'

export interface ClinicMembership {
  id: string
  clinicId: string
  clinicName: string
  role: Role
  permissions: ReadonlySet<Permission>
}

export interface OwnedOrganization {
  id: string
  name: string
}

export interface Session {
  userId: string
  username: string
  fullName: string
  phoneNumber: string | null
  email: string | null
  memberships: readonly ClinicMembership[]
  organizations: readonly OwnedOrganization[]
  /** The tenant requests go to right now. */
  scope: TenantScope
  /**
   * The cache scope every query key carries (§6.2): `clinic:<uuid>` or
   * `organization:<uuid>`. Named `clinicId` because that is what every key
   * factory already takes.
   */
  clinicId: string
  /** Label for the scope switcher: a clinic name or the organization's. */
  scopeName: string
  /** True in "all branches" mode: reads span branches, writes are disabled. */
  isAllBranches: boolean
  /** The caller's role in the active clinic; `owner` in all-branches mode. */
  role: Role
  /** The active membership's id (a doctor's id for "my patients" filters). Null in all-branches mode. */
  membershipId: string | null
  permissions: ReadonlySet<Permission>
}
