import { HttpResponse, http } from 'msw'
import { PAGE_SIZE } from '@/shared/api/pagination'
import { readJwtPayload } from '@/shared/lib/jwt'
import {
  accessTokenFor,
  errorEnvelope,
  MOCK_APPOINTMENTS,
  MOCK_CLINICS,
  MOCK_PASSWORD,
  MOCK_PATIENTS,
  MOCK_PAYMENTS,
  MOCK_PRESCRIPTIONS,
  MOCK_PROCEDURES,
  MOCK_SERVICES,
  MOCK_SPECIALTIES,
  MOCK_STAFF,
  MOCK_USERS,
  type MockUserKey,
} from './fixtures'

/**
 * Stands in for the Django v2 backend in tests and in `VITE_USE_MOCKS` runs.
 *
 * It enforces what the server enforces, because a kinder mock lets code pass
 * here and fail in production: a bearer token, a branch picked by `X-Clinic-Id`
 * the caller is a member of (or `X-Organization-Id` for an owner's read-only
 * "all branches" view), a permission per action, and 404 for rows of another
 * branch.
 */

type Row = Record<string, unknown> & { id: string }
type Body = Record<string, unknown>

interface Scope {
  user: MockUserKey
  /** Branches the request may read. */
  clinicIds: string[]
  /** The branch writes land in; null in all-branches mode. */
  clinicId: string | null
  permissions: readonly string[]
}

function authenticate(request: Request): MockUserKey | null {
  const header = request.headers.get('Authorization')
  if (header === null || !header.startsWith('Bearer ')) return null

  const payload = readJwtPayload(header.slice('Bearer '.length))
  if (payload === null) return null

  return (
    (Object.keys(MOCK_USERS) as MockUserKey[]).find(
      (key) => MOCK_USERS[key].id === payload.userId,
    ) ?? null
  )
}

const unauthorized = () =>
  HttpResponse.json(
    errorEnvelope({
      message: 'Given token not valid for any token type',
      messageKey: 'unauthorized',
      exceptionClass: 'InvalidToken',
    }),
    { status: 401 },
  )

const notFound = () =>
  HttpResponse.json(
    errorEnvelope({ message: 'Not found.', messageKey: 'not_found', exceptionClass: 'NotFound' }),
    { status: 404 },
  )

const forbidden = () =>
  HttpResponse.json(
    errorEnvelope({
      message: 'You do not have permission to perform this action.',
      messageKey: 'permission_denied',
      exceptionClass: 'PermissionDenied',
    }),
    { status: 403 },
  )

/** Field errors as DRF codes, the way `APIExceptionFormatter` flattens them. */
function validation(errors: Record<string, string>) {
  return HttpResponse.json(
    errorEnvelope({
      message: 'Validation error',
      messageKey: 'validation_error',
      errors,
      exceptionClass: 'ValidationError',
    }),
    { status: 400 },
  )
}

const ALL_CLINICS = [MOCK_CLINICS.main, MOCK_CLINICS.second]

/** `apps/tenancy/context.py`: header in, membership out, 404 for anything foreign. */
function resolveScope(request: Request, readAction: boolean): Scope | Response {
  const user = authenticate(request)
  if (user === null) return unauthorized()
  const account = MOCK_USERS[user]

  const organizationId = request.headers.get('X-Organization-Id')
  if (organizationId !== null) {
    const owns = account.organizations.some((organization) => organization.id === organizationId)
    if (!owns) return notFound()
    if (!readAction) {
      return validation({ clinic: 'clinic_required' })
    }
    const memberships: readonly { role: string; permissions: readonly string[] }[] =
      account.memberships
    const ownerMembership = memberships.find((membership) => membership.role === 'owner')
    return {
      user,
      clinicIds: ALL_CLINICS.map((clinic) => clinic.id),
      clinicId: null,
      permissions: ownerMembership?.permissions ?? [],
    }
  }

  const clinicId = request.headers.get('X-Clinic-Id')
  if (clinicId === null) return validation({ clinic: 'clinic_required' })
  const memberships: readonly { clinic: { id: string }; permissions: readonly string[] }[] =
    account.memberships
  const membership = memberships.find((candidate) => candidate.clinic.id === clinicId)
  if (membership === undefined) return notFound()
  return { user, clinicIds: [clinicId], clinicId, permissions: membership.permissions }
}

function guard(request: Request, permission: string, readAction = false): Scope | Response {
  const scope = resolveScope(request, readAction)
  if (scope instanceof Response) return scope
  return scope.permissions.includes(permission) ? scope : forbidden()
}

function membershipOf(user: MockUserKey): string | null {
  const memberships: readonly { id: string }[] = MOCK_USERS[user].memberships
  return memberships[0]?.id ?? null
}

function clinicNameOf(clinicId: string | null): string {
  return ALL_CLINICS.find((clinic) => clinic.id === clinicId)?.name ?? ''
}

/** In-memory tables, reset by `resetMockDatabase()` between tests. */
const db: Record<string, Row[]> = {}

function seed(): void {
  db.specialties = structuredClone(MOCK_SPECIALTIES)
  db.staff = structuredClone(MOCK_STAFF)
  db.services = structuredClone(MOCK_SERVICES)
  db.patients = structuredClone(MOCK_PATIENTS)
  db.appointments = structuredClone(MOCK_APPOINTMENTS)
  db.procedures = structuredClone(MOCK_PROCEDURES)
  db.payments = structuredClone(MOCK_PAYMENTS)
  db.prescriptions = structuredClone(MOCK_PRESCRIPTIONS)
  db.attachments = []
  db.clinics = structuredClone(ALL_CLINICS) as unknown as Row[]
}
seed()

export function resetMockDatabase(): void {
  seed()
}

function table(name: string): Row[] {
  const rows = db[name]
  if (rows === undefined) throw new Error(`Unknown mock table ${name}`)
  return rows
}

function staffNameOf(id: unknown): string | null {
  const name = table('staff').find((member) => member.id === id)?.full_name
  return typeof name === 'string' ? name : null
}

function patientNameOf(id: unknown): string {
  const name = table('patients').find((patient) => patient.id === id)?.full_name
  return typeof name === 'string' ? name : ''
}

function serviceOf(id: unknown): Row | undefined {
  return table('services').find((service) => service.id === id)
}

let sequence = 1000
function newId(): string {
  sequence += 1
  return `00000000-0000-4000-9000-${String(sequence).padStart(12, '0')}`
}

function inScope(row: Row, scope: Scope): boolean {
  // Rows without a clinic column (staff, services, specialties) belong to the main branch.
  const clinic = typeof row.clinic === 'string' ? row.clinic : MOCK_CLINICS.main.id
  return scope.clinicIds.includes(clinic)
}

function paginate(request: Request, rows: Row[]) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const start = (page - 1) * PAGE_SIZE
  const next = new URL(url)
  next.searchParams.set('page', String(page + 1))
  const previous = new URL(url)
  previous.searchParams.set('page', String(page - 1))
  return HttpResponse.json({
    count: rows.length,
    next: start + PAGE_SIZE < rows.length ? next.pathname + next.search : null,
    previous: page > 1 ? previous.pathname + previous.search : null,
    results: rows.slice(start, start + PAGE_SIZE),
  })
}

async function bodyOf(request: Request): Promise<Body> {
  const parsed: unknown = await request.json().catch(() => ({}))
  return typeof parsed === 'object' && parsed !== null ? (parsed as Body) : {}
}

function findRow(name: string, id: unknown, scope: Scope): Row | null {
  const row = table(name).find((candidate) => candidate.id === id)
  return row !== undefined && inScope(row, scope) ? row : null
}

function required(body: Body, fields: string[]): Response | null {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const value = body[field]
    if (value === undefined || value === null || value === '') {
      errors[field] = 'required'
    }
  }
  return Object.keys(errors).length > 0 ? validation(errors) : null
}

interface ResourceOptions {
  filter?: (row: Row, params: URLSearchParams) => boolean
  create?: (body: Body, scope: Scope) => Row | Response
  /** Omit to make the resource read-only after creation (money rows). */
  patch?: ((row: Row, body: Body) => void) | null
  /** Omit to keep the default hard delete; null to refuse DELETE entirely. */
  remove?: ((row: Row) => void) | null
}

/** List/retrieve/create/patch/delete for a clinic-scoped table. */
function resource(
  path: string,
  name: string,
  perms: { view: string; manage: string },
  options: ResourceOptions = {},
) {
  const base = `/api/v1/${path}/`
  const handlers = [
    http.get(base, ({ request }) => {
      const scope = guard(request, perms.view, true)
      if (scope instanceof Response) return scope
      const params = new URL(request.url).searchParams
      const rows = table(name).filter(
        (row) => inScope(row, scope) && (options.filter?.(row, params) ?? true),
      )
      return paginate(request, rows)
    }),
    http.get(`${base}:id/`, ({ request, params }) => {
      const scope = guard(request, perms.view, true)
      if (scope instanceof Response) return scope
      const row = findRow(name, params.id, scope)
      return row === null ? notFound() : HttpResponse.json(row)
    }),
    http.post(base, async ({ request }) => {
      const scope = guard(request, perms.manage)
      if (scope instanceof Response) return scope
      const body = await bodyOf(request)
      const created = options.create?.(body, scope) ?? {
        ...body,
        id: newId(),
        clinic: scope.clinicId,
      }
      if (created instanceof Response) return created
      table(name).unshift(created)
      return HttpResponse.json(created, { status: 201 })
    }),
  ]

  const patch = options.patch
  if (patch !== null) {
    handlers.push(
      http.patch(`${base}:id/`, async ({ request, params }) => {
        const scope = guard(request, perms.manage)
        if (scope instanceof Response) return scope
        const row = findRow(name, params.id, scope)
        if (row === null) return notFound()
        const body = await bodyOf(request)
        if (patch === undefined) Object.assign(row, body, { id: row.id })
        else patch(row, body)
        return HttpResponse.json(row)
      }),
    )
  }

  const remove = options.remove
  if (remove !== null) {
    handlers.push(
      http.delete(`${base}:id/`, ({ request, params }) => {
        const scope = guard(request, perms.manage)
        if (scope instanceof Response) return scope
        const row = findRow(name, params.id, scope)
        if (row === null) return notFound()
        if (remove === undefined)
          db[name] = table(name).filter((candidate) => candidate.id !== row.id)
        else remove(row)
        return new HttpResponse(null, { status: 204 })
      }),
    )
  }

  return handlers
}

/** `POST …/:id/void/` — money is never edited or deleted, only voided with a reason. */
function voidAction(path: string, name: string, permission: string) {
  return http.post(`/api/v1/${path}/:id/void/`, async ({ request, params }) => {
    const scope = guard(request, permission)
    if (scope instanceof Response) return scope
    const row = findRow(name, params.id, scope)
    if (row === null) return notFound()
    const body = await bodyOf(request)
    const missing = required(body, ['reason'])
    if (missing !== null) return missing
    Object.assign(row, { voided_at: new Date().toISOString(), void_reason: body.reason })
    return HttpResponse.json(row)
  })
}

/** Mirrors `PatientBalanceViewSet`: charged minus paid, voided lines left out. */
function balanceRows(scope: Scope): Row[] {
  const sum = (name: string, field: string, patientId: string) =>
    table(name)
      .filter((row) => row.patient === patientId && row.voided_at === null)
      .reduce((total, row) => total + Number(row[field]), 0)
  return table('patients')
    .filter((patient) => inScope(patient, scope))
    .map((patient) => {
      const charged = sum('procedures', 'total', patient.id)
      const paid = sum('payments', 'amount', patient.id)
      return {
        id: patient.id,
        clinic: patient.clinic,
        clinic_name: patient.clinic_name,
        full_name: patient.full_name,
        phone_number: patient.phone_number,
        charged: charged.toFixed(2),
        paid: paid.toFixed(2),
        debt: (charged - paid).toFixed(2),
      }
    })
}

function byParam(row: Row, params: URLSearchParams, ...fields: string[]): boolean {
  return fields.every((field) => !params.has(field) || row[field] === params.get(field))
}

export const handlers = [
  http.post('/api/v1/auth/login/', async ({ request }) => {
    const body = await bodyOf(request)
    const match = (Object.keys(MOCK_USERS) as MockUserKey[]).find(
      (key) => MOCK_USERS[key].username === body.username,
    )

    if (match === undefined || body.password !== MOCK_PASSWORD) {
      return HttpResponse.json(
        errorEnvelope({
          message: 'Invalid username or password',
          messageKey: 'invalid_username_or_password',
          exceptionClass: 'ValidationError',
        }),
        { status: 400 },
      )
    }

    return HttpResponse.json({
      message: 'Ok',
      result: { access_token: accessTokenFor(match), refresh_token: `refresh-${match}` },
    })
  }),

  http.post('/api/v1/auth/logout/', () => new HttpResponse(null, { status: 205 })),

  http.get('/api/v1/auth/me/', ({ request }) => {
    const user = authenticate(request)
    if (user === null) return unauthorized()
    return HttpResponse.json(MOCK_USERS[user])
  }),

  http.get('/api/v1/clinic/', ({ request }) => {
    const scope = guard(request, 'clinic:view')
    if (scope instanceof Response) return scope
    return HttpResponse.json(table('clinics').find((clinic) => clinic.id === scope.clinicId))
  }),

  http.patch('/api/v1/clinic/', async ({ request }) => {
    const scope = guard(request, 'clinic:manage')
    if (scope instanceof Response) return scope
    const clinic = table('clinics').find((candidate) => candidate.id === scope.clinicId)
    if (clinic === undefined) return notFound()
    Object.assign(clinic, await bodyOf(request), { id: clinic.id })
    return HttpResponse.json(clinic)
  }),

  ...resource(
    'specialties',
    'specialties',
    { view: 'staff:view', manage: 'specialty:manage' },
    {
      create: (body, scope) =>
        required(body, ['name']) ?? { id: newId(), clinic: scope.clinicId, name: body.name },
    },
  ),

  http.post('/api/v1/staff/:id/reactivate/', ({ request, params }) => {
    const scope = guard(request, 'staff:manage')
    if (scope instanceof Response) return scope
    const row = findRow('staff', params.id, scope)
    if (row === null) return notFound()
    row.is_active = true
    return HttpResponse.json(row)
  }),

  ...resource(
    'staff',
    'staff',
    { view: 'staff:view', manage: 'staff:manage' },
    {
      filter: (row, params) =>
        byParam(row, params, 'role', 'specialty') &&
        (!params.has('is_active') || String(row.is_active) === params.get('is_active')),
      create: (body, scope) => {
        const missing = required(body, ['username', 'full_name', 'password', 'role'])
        if (missing !== null) return missing
        if (table('staff').some((member) => member.username === body.username)) {
          return validation({ username: 'duplicate' })
        }
        const { password: _password, ...rest } = body
        return {
          phone_number: '',
          email: '',
          specialty: null,
          experience_years: null,
          biography: '',
          ...rest,
          id: newId(),
          clinic: scope.clinicId,
          is_active: true,
          specialty_name:
            table('specialties').find((specialty) => specialty.id === body.specialty)?.name ?? null,
        }
      },
      patch: (row, body) => {
        const { password: _password, ...rest } = body
        Object.assign(row, rest, { id: row.id })
        if ('specialty' in body) {
          row.specialty_name =
            table('specialties').find((specialty) => specialty.id === body.specialty)?.name ?? null
        }
      },
      // Staff are deactivated, not deleted: their name stays on past visits.
      remove: (row) => {
        row.is_active = false
      },
    },
  ),

  ...resource(
    'services',
    'services',
    { view: 'service:view', manage: 'service:manage' },
    {
      filter: (row, params) =>
        byParam(row, params, 'specialty', 'category') &&
        (!params.has('is_active') || String(row.is_active) === params.get('is_active')),
      create: (body, scope) =>
        required(body, ['name', 'price']) ?? {
          code: '',
          category: null,
          specialty: null,
          duration_minutes: 30,
          is_active: true,
          ...body,
          id: newId(),
          clinic: scope.clinicId,
        },
    },
  ),

  // Text search lives in a POST body so names never reach a URL or an access log.
  http.post('/api/v1/patients/search/', async ({ request }) => {
    const scope = guard(request, 'patient:view', true)
    if (scope instanceof Response) return scope
    const body = await bodyOf(request)
    const query = typeof body.query === 'string' ? body.query.trim().toLowerCase() : ''
    if (query.length < 2) {
      return validation({ query: 'min_length' })
    }
    const rows = table('patients').filter(
      (row) =>
        inScope(row, scope) &&
        (body.include_archived === true || row.archived_at === null) &&
        (String(row.full_name).toLowerCase().includes(query) ||
          String(row.phone_number).includes(query)),
    )
    return paginate(request, rows)
  }),

  http.post('/api/v1/patients/:id/archive/', ({ request, params }) => {
    const scope = guard(request, 'patient:archive')
    if (scope instanceof Response) return scope
    const row = findRow('patients', params.id, scope)
    if (row === null) return notFound()
    row.archived_at = new Date().toISOString()
    return HttpResponse.json(row)
  }),

  http.post('/api/v1/patients/:id/restore/', ({ request, params }) => {
    const scope = guard(request, 'patient:archive')
    if (scope instanceof Response) return scope
    const row = findRow('patients', params.id, scope)
    if (row === null) return notFound()
    row.archived_at = null
    return HttpResponse.json(row)
  }),

  ...resource(
    'patients',
    'patients',
    { view: 'patient:view', manage: 'patient:manage' },
    {
      filter: (row, params) =>
        (params.get('archived') === 'true' ? row.archived_at !== null : row.archived_at === null) &&
        byParam(row, params, 'primary_doctor', 'gender'),
      create: (body, scope) =>
        required(body, ['full_name']) ?? {
          phone_number: '',
          birth_date: null,
          gender: '',
          address: '',
          notes: '',
          primary_doctor: null,
          ...body,
          id: newId(),
          clinic: scope.clinicId,
          clinic_name: clinicNameOf(scope.clinicId),
          primary_doctor_name: staffNameOf(body.primary_doctor),
          archived_at: null,
          created_at: new Date().toISOString(),
        },
      patch: (row, body) => {
        Object.assign(row, body, { id: row.id })
        if ('primary_doctor' in body) row.primary_doctor_name = staffNameOf(body.primary_doctor)
      },
      // Patients are never deleted, only archived.
      remove: null,
    },
  ),

  ...resource(
    'appointments',
    'appointments',
    { view: 'appointment:view', manage: 'appointment:manage' },
    {
      filter: (row, params) => {
        const start = String(row.start_at)
        const from = params.get('start_from')
        const to = params.get('start_to')
        const statuses = params.getAll('status')
        return (
          (from === null || start >= from) &&
          (to === null || start < to) &&
          byParam(row, params, 'doctor', 'patient', 'chair') &&
          (statuses.length === 0 || statuses.includes(String(row.status)))
        )
      },
      create: (body, scope) => {
        const missing = required(body, ['patient', 'doctor', 'start_at'])
        if (missing !== null) return missing
        const start = new Date(String(body.start_at))
        const minutes = Number(serviceOf(body.service)?.duration_minutes ?? 30)
        return {
          chair: null,
          service: null,
          status: 'scheduled',
          notes: '',
          end_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
          ...body,
          id: newId(),
          clinic: scope.clinicId,
          clinic_name: clinicNameOf(scope.clinicId),
          patient_name: patientNameOf(body.patient),
          doctor_name: staffNameOf(body.doctor),
        }
      },
      patch: (row, body) => {
        Object.assign(row, body, { id: row.id })
        if ('patient' in body) row.patient_name = patientNameOf(body.patient)
        if ('doctor' in body) row.doctor_name = staffNameOf(body.doctor)
      },
    },
  ),

  voidAction('procedures', 'procedures', 'procedure:void'),

  ...resource(
    'procedures',
    'procedures',
    { view: 'procedure:view', manage: 'procedure:manage' },
    {
      filter: (row, params) =>
        byParam(row, params, 'patient', 'doctor', 'service') &&
        (!params.has('voided') || (params.get('voided') === 'true') === (row.voided_at !== null)),
      create: (body, scope) => {
        const missing = required(body, ['patient', 'service'])
        if (missing !== null) return missing
        const service = serviceOf(body.service)
        const quantity = Number(body.quantity ?? 1)
        const unitPrice = Number(body.unit_price ?? service?.price ?? 0)
        const discount = Number(body.discount_percent ?? 0)
        const doctor = body.doctor ?? membershipOf(scope.user)
        return {
          plan_item: null,
          appointment: null,
          tooth: null,
          surfaces: [],
          notes: '',
          ...body,
          doctor,
          doctor_name: staffNameOf(doctor),
          quantity,
          unit_price: unitPrice.toFixed(2),
          discount_percent: discount.toFixed(2),
          total: (quantity * unitPrice * (1 - discount / 100)).toFixed(2),
          id: newId(),
          clinic: scope.clinicId,
          clinic_name: clinicNameOf(scope.clinicId),
          service_name: service?.name ?? '',
          patient_name: patientNameOf(body.patient),
          performed_at: body.performed_at ?? new Date().toISOString(),
          voided_at: null,
          void_reason: '',
        }
      },
      // Money is append-only: only the notes change after the fact.
      patch: (row, body) => {
        if (typeof body.notes === 'string') row.notes = body.notes
      },
      remove: null,
    },
  ),

  voidAction('payments', 'payments', 'payment:void'),

  ...resource(
    'payments',
    'payments',
    { view: 'payment:view', manage: 'payment:manage' },
    {
      filter: (row, params) => byParam(row, params, 'patient', 'method'),
      create: (body, scope) => {
        const missing = required(body, ['patient', 'amount', 'method'])
        if (missing !== null) return missing
        return {
          notes: '',
          ...body,
          amount: Number(body.amount).toFixed(2),
          id: newId(),
          clinic: scope.clinicId,
          clinic_name: clinicNameOf(scope.clinicId),
          patient_name: patientNameOf(body.patient),
          paid_at: body.paid_at ?? new Date().toISOString(),
          received_by: membershipOf(scope.user),
          received_by_name: MOCK_USERS[scope.user].full_name,
          voided_at: null,
          void_reason: '',
        }
      },
      patch: null,
      remove: null,
    },
  ),

  http.get('/api/v1/balances/', ({ request }) => {
    const scope = guard(request, 'payment:view', true)
    if (scope instanceof Response) return scope
    const params = new URL(request.url).searchParams
    const rows = balanceRows(scope)
      .filter((row) => params.get('has_debt') !== 'true' || Number(row.debt) > 0)
      .sort((a, b) => Number(b.debt) - Number(a.debt))
    return paginate(request, rows)
  }),

  http.get('/api/v1/balances/:id/', ({ request, params }) => {
    const scope = guard(request, 'payment:view', true)
    if (scope instanceof Response) return scope
    const row = balanceRows(scope).find((balance) => balance.id === params.id)
    return row === undefined ? notFound() : HttpResponse.json(row)
  }),

  ...resource(
    'prescriptions',
    'prescriptions',
    { view: 'prescription:view', manage: 'prescription:manage' },
    {
      filter: (row, params) => byParam(row, params, 'patient', 'doctor'),
      create: (body, scope) => {
        const missing = required(body, ['patient'])
        if (missing !== null) return missing
        const items = Array.isArray(body.items) ? (body.items as Body[]) : []
        if (items.length === 0) return validation({ items: 'required' })
        const doctor = body.doctor ?? membershipOf(scope.user)
        return {
          notes: '',
          ...body,
          doctor,
          doctor_name: staffNameOf(doctor),
          items: items.map((item) => ({ ...item, id: newId() })),
          id: newId(),
          clinic: scope.clinicId,
          clinic_name: clinicNameOf(scope.clinicId),
          created_at: new Date().toISOString(),
        }
      },
    },
  ),

  // Multipart, unlike every other write.
  http.post('/api/v1/attachments/', async ({ request }) => {
    const scope = guard(request, 'attachment:manage')
    if (scope instanceof Response) return scope
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return validation({ file: 'required' })
    const tooth = form.get('tooth')
    const row: Row = {
      id: newId(),
      clinic: scope.clinicId,
      clinic_name: clinicNameOf(scope.clinicId),
      patient: form.get('patient'),
      kind: form.get('kind') ?? 'photo',
      tooth: tooth === null || tooth === '' ? null : Number(tooth),
      content_type: file.type,
      size_bytes: file.size,
      taken_at: null,
      notes: '',
      created_at: new Date().toISOString(),
    }
    table('attachments').unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),

  http.get('/api/v1/attachments/:id/download/', ({ request, params }) => {
    const scope = guard(request, 'attachment:view', true)
    if (scope instanceof Response) return scope
    const row = findRow('attachments', params.id, scope)
    if (row === null) return notFound()
    return new HttpResponse(new Blob(['mock'], { type: String(row.content_type) }), {
      headers: { 'Content-Type': String(row.content_type) },
    })
  }),

  ...resource(
    'attachments',
    'attachments',
    { view: 'attachment:view', manage: 'attachment:manage' },
    {
      filter: (row, params) => byParam(row, params, 'patient', 'kind'),
    },
  ),
]
