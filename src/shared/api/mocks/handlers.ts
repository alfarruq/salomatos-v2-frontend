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
  db.medical_histories = []
  db.expenses = []
  db.recurring_expenses = []
  db.recurring_skips = []
  db.compensations = []
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

/** Created on first read, as the backend's `get_or_create` does. */
function medicalHistoryOf(patientId: string): Row {
  const rows = table('medical_histories')
  const existing = rows.find((row) => row.patient === patientId)
  if (existing !== undefined) return existing
  const row: Row = {
    id: newId(),
    patient: patientId,
    allergies: '',
    chronic_conditions: '',
    current_medications: '',
    is_pregnant: null,
    notes: '',
    updated_at: new Date().toISOString(),
  }
  rows.push(row)
  return row
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
  /** Shapes a stored row for the response, e.g. fields the serializer computes per viewer. */
  present?: (row: Row, scope: Scope) => Row
  /** False for viewsets with `pagination_class = None`, which answer a plain array. */
  paginated?: boolean
}

/** List/retrieve/create/patch/delete for a clinic-scoped table. */
function resource(
  path: string,
  name: string,
  perms: { view: string; manage: string },
  options: ResourceOptions = {},
) {
  const base = `/api/v1/${path}/`
  const show = (row: Row, scope: Scope) => options.present?.(row, scope) ?? row
  const handlers = [
    http.get(base, ({ request }) => {
      const scope = guard(request, perms.view, true)
      if (scope instanceof Response) return scope
      const params = new URL(request.url).searchParams
      const rows = table(name).filter(
        (row) => inScope(row, scope) && (options.filter?.(row, params) ?? true),
      )
      const shown = rows.map((row) => show(row, scope))
      return options.paginated === false ? HttpResponse.json(shown) : paginate(request, shown)
    }),
    http.get(`${base}:id/`, ({ request, params }) => {
      const scope = guard(request, perms.view, true)
      if (scope instanceof Response) return scope
      const row = findRow(name, params.id, scope)
      return row === null ? notFound() : HttpResponse.json(show(row, scope))
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
      return HttpResponse.json(show(created, scope), { status: 201 })
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
        return HttpResponse.json(show(row, scope))
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

/** `apps/finance`: pay rows stay hidden from anyone without `payroll:view`. */
const PAYROLL_CATEGORIES = ['doctor_share', 'staff_salary']
const FIXED_CATEGORIES = ['rent', 'utilities', 'communication', 'taxes_fees']

function seesPay(scope: Scope): boolean {
  return scope.permissions.includes('payroll:view')
}

function expenseRows(scope: Scope): Row[] {
  return table('expenses').filter(
    (row) =>
      inScope(row, scope) && (seesPay(scope) || !PAYROLL_CATEGORIES.includes(String(row.category))),
  )
}

function liveSum(rows: Row[], field: string): number {
  return rows
    .filter((row) => row.voided_at === null || row.voided_at === undefined)
    .reduce((total, row) => total + Number(row[field]), 0)
}

function between(value: unknown, from: string, to: string): boolean {
  const day = String(value).slice(0, 10)
  return day >= from && day <= to
}

/** `?from&to`, defaulting to the last 30 days like `periods.parse_range`. */
function rangeOf(request: Request): { from: string; to: string; previous: [string, string] } {
  const params = new URL(request.url).searchParams
  const to = params.get('to') ?? new Date().toISOString().slice(0, 10)
  const from =
    params.get('from') ?? new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  const previousTo = new Date(Date.parse(from) - 86_400_000).toISOString().slice(0, 10)
  const previousFrom = new Date(Date.parse(from) - days * 86_400_000).toISOString().slice(0, 10)
  return { from, to, previous: [previousFrom, previousTo] }
}

function expenseTotals(rows: Row[]) {
  const live = rows.filter((row) => row.voided_at === null)
  const of = (pick: (category: string) => boolean) =>
    liveSum(
      live.filter((row) => pick(String(row.category))),
      'amount',
    ).toFixed(2)
  return {
    total: liveSum(live, 'amount').toFixed(2),
    count: live.length,
    payroll: of((category) => PAYROLL_CATEGORIES.includes(category)),
    fixed: of((category) => FIXED_CATEGORIES.includes(category)),
    variable: of(
      (category) => !PAYROLL_CATEGORIES.includes(category) && !FIXED_CATEGORIES.includes(category),
    ),
  }
}

function monthOf(day: string): string {
  return day.slice(0, 7)
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

/** The month's slots of every active template, as `RecurringExpenseViewSet.due` lays them out. */
function dueMonth(scope: Scope, month: string) {
  const today = new Date().toISOString().slice(0, 10)
  const items = table('recurring_expenses')
    .filter((template) => inScope(template, scope) && template.is_active === true)
    .map((template) => {
      const dueDate = `${month}-${String(template.day_of_month).padStart(2, '0')}`
      const paid = table('expenses').find(
        (row) => row.recurring === template.id && row.period === month && row.voided_at === null,
      )
      const skip = table('recurring_skips').find(
        (row) => row.recurring === template.id && row.period === month,
      )
      const status =
        paid !== undefined
          ? 'paid'
          : skip !== undefined
            ? 'skipped'
            : dueDate < today
              ? 'overdue'
              : 'due'
      return {
        recurring: template.id,
        name: template.name,
        category: template.category,
        amount: template.amount,
        method: template.method,
        payee: template.payee,
        due_date: dueDate,
        status,
        expense: paid?.id ?? null,
        paid_amount: paid?.amount ?? null,
        paid_on: paid?.spent_on ?? null,
        skip_reason: skip?.reason ?? null,
      }
    })
  const expected = items
    .filter((item) => item.status !== 'skipped')
    .reduce((total, item) => total + Number(item.amount), 0)
  const paid = items.reduce((total, item) => total + Number(item.paid_amount ?? 0), 0)
  return {
    month,
    totals: {
      expected: expected.toFixed(2),
      paid: paid.toFixed(2),
      remaining: Math.max(0, expected - paid).toFixed(2),
    },
    items,
  }
}

/** The terms in force in `month`: the newest entry that started by then. */
function termsOf(doctorId: string, month: string): Row | null {
  return (
    table('compensations')
      .filter((row) => row.doctor === doctorId && String(row.effective_from) <= month)
      .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0] ?? null
  )
}

/**
 * A simplified `payroll.compute`: billed is the doctor's work in the month,
 * collected the patients' payments that month capped at it. The real FIFO
 * allocation lives on the server; this only has to be plausible.
 */
function payrollRows(scope: Scope, month: string) {
  const doctors = table('staff').filter(
    (member) => member.role === 'doctor' && inScope(member, scope),
  )
  const rows = doctors.map((doctor) => {
    const terms = termsOf(doctor.id, month)
    const work = table('procedures').filter(
      (row) =>
        row.doctor === doctor.id &&
        row.voided_at === null &&
        monthOf(String(row.performed_at)) === month,
    )
    const billed = liveSum(work, 'total')
    const patients = new Set(work.map((row) => row.patient))
    const paidIn = liveSum(
      table('payments').filter(
        (row) => patients.has(row.patient) && monthOf(String(row.paid_at)) === month,
      ),
      'amount',
    )
    const collected = Math.min(billed, paidIn)
    const base = terms?.base === 'billed' ? billed : collected
    const accrued = terms === null ? 0 : Number(terms.fixed) + (Number(terms.percent) / 100) * base
    // Work still waiting on the patient: on collected terms it pays the doctor later.
    const pending = billed - collected
    const pendingShare =
      terms === null || terms.base === 'billed' ? 0 : (Number(terms.percent) / 100) * pending
    const paid = liveSum(
      table('expenses').filter(
        (row) =>
          row.category === 'doctor_share' && row.doctor === doctor.id && row.period === month,
      ),
      'amount',
    )
    return {
      doctor: doctor.id,
      doctor_name: doctor.full_name,
      clinic_name: clinicNameOf(typeof doctor.clinic === 'string' ? doctor.clinic : null),
      is_active: doctor.is_active,
      compensation: terms,
      billed: billed.toFixed(2),
      collected: collected.toFixed(2),
      base_amount: base.toFixed(2),
      accrued: accrued.toFixed(2),
      pending: pending.toFixed(2),
      pending_share: pendingShare.toFixed(2),
      opening: '0.00',
      paid: paid.toFixed(2),
      balance: (accrued - paid).toFixed(2),
    }
  })
  const total = (field: 'accrued' | 'pending_share' | 'paid' | 'balance') =>
    rows.reduce((sum, row) => sum + Number(row[field]), 0).toFixed(2)
  return {
    month,
    rows,
    totals: {
      accrued: total('accrued'),
      pending_share: total('pending_share'),
      paid: total('paid'),
      balance: total('balance'),
    },
  }
}

/**
 * `EarningsViewSet.earnings`: the caller's payroll row and their procedures,
 * each paid from the patient's money oldest work first (`allocation.run`).
 */
function myEarnings(scope: Scope, month: string) {
  const me = membershipOf(scope.user)
  const summary = payrollRows(scope, month).rows.find((row) => row.doctor === me) ?? null
  const paidOf = new Map<string, number>()
  const byPatient = new Map<unknown, Row[]>()
  for (const row of table('procedures')) {
    if (row.voided_at !== null || !inScope(row, scope) || monthOf(String(row.performed_at)) > month)
      continue
    byPatient.set(row.patient, [...(byPatient.get(row.patient) ?? []), row])
  }
  for (const [patient, work] of byPatient) {
    let money = liveSum(
      table('payments').filter(
        (row) => row.patient === patient && monthOf(String(row.paid_at)) <= month,
      ),
      'amount',
    )
    for (const row of work.sort((a, b) =>
      String(a.performed_at).localeCompare(String(b.performed_at)),
    )) {
      const share = Math.min(Number(row.total), money)
      paidOf.set(row.id, share)
      money -= share
    }
  }
  const lines = table('procedures')
    .filter((row) => row.doctor === me && row.voided_at === null && inScope(row, scope))
    .filter((row) => {
      const owed = Number(row.total) - (paidOf.get(row.id) ?? 0) > 0
      const when = monthOf(String(row.performed_at))
      return when === month || (when < month && owed)
    })
    .sort((a, b) => String(b.performed_at).localeCompare(String(a.performed_at)))
    .map((row) => {
      const paid = paidOf.get(row.id) ?? 0
      const total = Number(row.total)
      const patient = table('patients').find((candidate) => candidate.id === row.patient)
      return {
        procedure: row.id,
        performed_at: row.performed_at,
        patient: row.patient,
        patient_name: patient?.full_name ?? null,
        service_name: row.service_name ?? '',
        tooth: row.tooth ?? null,
        total: total.toFixed(2),
        paid: paid.toFixed(2),
        unpaid: (total - paid).toFixed(2),
        status: paid >= total ? 'completed' : 'in_progress',
      }
    })
  return {
    month,
    summary: summary ?? {
      doctor: me,
      doctor_name: MOCK_USERS[scope.user].full_name,
      clinic_name: clinicNameOf(scope.clinicId),
      is_active: true,
      compensation: null,
      billed: '0.00',
      collected: '0.00',
      base_amount: '0.00',
      accrued: '0.00',
      pending: '0.00',
      pending_share: '0.00',
      opening: '0.00',
      paid: '0.00',
      balance: '0.00',
    },
    lines,
  }
}

function newExpense(scope: Scope, fields: Body): Row {
  return {
    payee: '',
    notes: '',
    doctor: null,
    doctor_name: null,
    period: null,
    recurring: null,
    ...fields,
    amount: Number(fields.amount).toFixed(2),
    id: newId(),
    clinic: scope.clinicId,
    clinic_name: clinicNameOf(scope.clinicId),
    spent_on: fields.spent_on ?? new Date().toISOString().slice(0, 10),
    created_by: membershipOf(scope.user),
    created_by_name: MOCK_USERS[scope.user].full_name,
    voided_at: null,
    void_reason: '',
  }
}

/** Mirrors `reports.finance_overview`, one bucket per range: enough for the screen. */
function financeOverview(scope: Scope, from: string, to: string, previous: [string, string]) {
  const income = (start: string, end: string) => {
    const billed = liveSum(
      table('procedures').filter(
        (row) => inScope(row, scope) && between(row.performed_at, start, end),
      ),
      'total',
    )
    const collected = liveSum(
      table('payments').filter((row) => inScope(row, scope) && between(row.paid_at, start, end)),
      'amount',
    )
    const expenses = liveSum(
      expenseRows(scope).filter((row) => between(row.spent_on, start, end)),
      'amount',
    )
    return {
      billed: billed.toFixed(2),
      collected: collected.toFixed(2),
      expenses: expenses.toFixed(2),
      profit: seesPay(scope) ? (collected - expenses).toFixed(2) : null,
    }
  }
  const current = income(from, to)
  const balances = balanceRows(scope).filter((row) => Number(row.debt) > 0)
  const payments = table('payments').filter(
    (row) => inScope(row, scope) && row.voided_at === null && between(row.paid_at, from, to),
  )
  const methods = [...new Set(payments.map((row) => String(row.method)))].map((method) => ({
    method,
    amount: liveSum(
      payments.filter((row) => row.method === method),
      'amount',
    ).toFixed(2),
  }))
  return {
    from,
    to,
    bucket: 'day',
    totals: {
      ...current,
      outstanding_debt: balances.reduce((sum, row) => sum + Number(row.debt), 0).toFixed(2),
      debtors_count: balances.length,
    },
    previous_totals: income(...previous),
    includes_payroll: seesPay(scope),
    series: [
      {
        start: from,
        billed: current.billed,
        collected: current.collected,
        expenses: current.expenses,
      },
    ],
    payment_methods: methods,
    doctors: [],
    services: [],
  }
}

/** The clinic's wall clock is UTC+5 (Asia/Tashkent, no DST); the mock does not need zones. */
function tashkent(instant: unknown): Date {
  return new Date(Date.parse(String(instant)) + 5 * 3_600_000)
}

function localDay(instant: unknown): string {
  return tashkent(instant).toISOString().slice(0, 10)
}

/**
 * Mirrors `statistics.statistics_overview`, one bucket per range: enough for the screen.
 * `doctor` narrows every figure to one doctor's work and patients.
 */
function statisticsOverview(
  scope: Scope,
  from: string,
  to: string,
  previous: [string, string],
  doctor: string | null,
) {
  const mine = (row: Row) => doctor === null || row.doctor === doctor
  const visitsIn = (start: string, end: string) =>
    table('appointments').filter(
      (row) => inScope(row, scope) && mine(row) && between(localDay(row.start_at), start, end),
    )
  const treatedIn = (start: string, end: string) =>
    table('procedures').filter(
      (row) =>
        inScope(row, scope) &&
        mine(row) &&
        row.voided_at === null &&
        between(localDay(row.performed_at), start, end),
    )
  const totals = (start: string, end: string) => {
    const visits = visitsIn(start, end)
    const treated = treatedIn(start, end)
    const seen = new Set([
      ...treated.map((row) => row.patient),
      ...visits.filter((row) => row.status === 'completed').map((row) => row.patient),
    ])
    const patients = table('patients').filter(
      (row) => inScope(row, scope) && (doctor === null || row.primary_doctor === doctor),
    )
    const everyone = table('patients').filter((row) => inScope(row, scope))
    return {
      appointments: visits.filter((row) => row.status !== 'cancelled').length,
      appointments_completed: visits.filter((row) => row.status === 'completed').length,
      no_shows: visits.filter((row) => row.status === 'no_show').length,
      cancellations: visits.filter((row) => row.status === 'cancelled').length,
      new_patients: patients.filter((row) => between(localDay(row.created_at), start, end)).length,
      returning_patients: everyone.filter(
        (row) => seen.has(row.id) && localDay(row.created_at) < start,
      ).length,
      procedures: treated.length,
      plans_accepted: 0,
    }
  }
  const current = totals(from, to)
  const visits = visitsIn(from, to).filter((row) => row.status !== 'cancelled')
  const treated = treatedIn(from, to)
  const countBy = <K>(rows: Row[], key: (row: Row) => K) => {
    const counts = new Map<K, number>()
    for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1)
    return [...counts]
  }
  const doctorIds = [...new Set([...visits, ...treated].map((row) => String(row.doctor)))]
  return {
    from,
    to,
    bucket: 'day',
    totals: current,
    previous_totals: totals(...previous),
    appointments_series: [
      { start: from, total: current.appointments, completed: current.appointments_completed },
    ],
    procedures_series: [{ start: from, count: current.procedures }],
    doctors: doctorIds.map((doctor) => {
      const member = table('staff').find((row) => row.id === doctor)
      return {
        doctor,
        doctor_name: staffNameOf(doctor) ?? '',
        clinic_name: clinicNameOf(typeof member?.clinic === 'string' ? member.clinic : null),
        appointments: visits.filter((row) => row.doctor === doctor).length,
        appointments_completed: visits.filter(
          (row) => row.doctor === doctor && row.status === 'completed',
        ).length,
        procedures: treated.filter((row) => row.doctor === doctor).length,
      }
    }),
    services: countBy(treated, (row) => String(row.service)).map(([service, count]) => ({
      service,
      service_name: String(serviceOf(service)?.name ?? ''),
      count,
    })),
    busy_slots: countBy(visits, (row) => {
      const local = tashkent(row.start_at)
      return `${local.getUTCDay() === 0 ? 7 : local.getUTCDay()}:${local.getUTCHours()}`
    }).map(([slot, appointments]) => {
      const [weekday, hour] = slot.split(':').map(Number)
      return { weekday, hour, appointments }
    }),
    teeth: countBy(
      treated.filter((row) => typeof row.tooth === 'number'),
      (row) => Number(row.tooth),
    ).map(([tooth, count]) => ({ tooth, count })),
  }
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
      // Mock-only: the refresh token is the same fake JWT, so the refresh handler can read the user.
      result: { access_token: accessTokenFor(match), refresh_token: accessTokenFor(match) },
    })
  }),

  http.post('/api/v1/auth/refresh/', async ({ request }) => {
    const body = await bodyOf(request)
    const payload =
      typeof body.refresh_token === 'string' ? readJwtPayload(body.refresh_token) : null
    const match = (Object.keys(MOCK_USERS) as MockUserKey[]).find(
      (key) => MOCK_USERS[key].id === payload?.userId,
    )
    if (match === undefined) return unauthorized()
    return HttpResponse.json({
      result: { access_token: accessTokenFor(match), refresh_token: accessTokenFor(match) },
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
      paginated: false,
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
      // `StaffSerializer.current_compensation`: owners only, doctors only.
      present: (row, scope) => {
        if (!scope.permissions.includes('payroll:view')) return row
        const terms = row.role === 'doctor' ? termsOf(String(row.id), currentMonthKey()) : null
        return {
          ...row,
          current_compensation:
            terms === null
              ? null
              : {
                  percent: terms.percent,
                  fixed: terms.fixed,
                  base: terms.base,
                  effective_from: terms.effective_from,
                },
        }
      },
      create: (body, scope) => {
        const missing = required(body, ['username', 'full_name', 'password', 'role'])
        if (missing !== null) return missing
        if (table('staff').some((member) => member.username === body.username)) {
          return validation({ username: 'duplicate' })
        }
        const { password: _password, compensation, ...rest } = body
        const id = newId()
        if (compensation !== undefined && compensation !== null) {
          if (body.role !== 'doctor') return validation({ compensation: 'invalid' })
          if (!scope.permissions.includes('payroll:manage')) return forbidden()
          const terms = compensation as Body
          const percent = Number(terms.percent ?? 0)
          const fixed = Number(terms.fixed ?? 0)
          if (percent === 0 && fixed === 0)
            return validation({ 'compensation.percent': 'required' })
          table('compensations').unshift({
            id: newId(),
            clinic: scope.clinicId,
            doctor: id,
            percent: percent.toFixed(2),
            fixed: fixed.toFixed(2),
            base: terms.base ?? 'collected',
            effective_from: currentMonthKey(),
            created_by: membershipOf(scope.user),
            created_by_name: MOCK_USERS[scope.user].full_name,
          })
        }
        return {
          phone_number: '',
          email: '',
          specialty: null,
          experience_years: null,
          biography: '',
          ...rest,
          id,
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

  http.get('/api/v1/patients/:id/medical-history/', ({ request, params }) => {
    const scope = guard(request, 'patient:view', true)
    if (scope instanceof Response) return scope
    if (findRow('patients', params.id, scope) === null) return notFound()
    return HttpResponse.json(medicalHistoryOf(String(params.id)))
  }),

  http.patch('/api/v1/patients/:id/medical-history/', async ({ request, params }) => {
    const scope = guard(request, 'patient:manage')
    if (scope instanceof Response) return scope
    if (findRow('patients', params.id, scope) === null) return notFound()
    const row = medicalHistoryOf(String(params.id))
    Object.assign(row, await bodyOf(request), { updated_at: new Date().toISOString() })
    return HttpResponse.json(row)
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

  // `ProcedureViewSet.complete`: multi-visit work is finished; the charge is untouched.
  http.post('/api/v1/procedures/:id/complete/', ({ request, params }) => {
    const scope = guard(request, 'procedure:manage')
    if (scope instanceof Response) return scope
    const row = findRow('procedures', params.id, scope)
    if (row === null) return notFound()
    if (row.voided_at !== null || row.status === 'completed') {
      return HttpResponse.json({ detail: 'Already completed.' }, { status: 400 })
    }
    Object.assign(row, { status: 'completed', completed_at: new Date().toISOString() })
    return HttpResponse.json(row)
  }),

  ...resource(
    'procedures',
    'procedures',
    { view: 'procedure:view', manage: 'procedure:manage' },
    {
      filter: (row, params) =>
        byParam(row, params, 'patient', 'doctor', 'service', 'status') &&
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
          status: body.status ?? 'completed',
          completed_at:
            body.status === 'in_progress' ? null : (body.performed_at ?? new Date().toISOString()),
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

  // Before `resource('expenses')`, so `summary/` is not read as an id.
  http.get('/api/v1/expenses/summary/', ({ request }) => {
    const scope = guard(request, 'expense:view', true)
    if (scope instanceof Response) return scope
    const { from, to, previous } = rangeOf(request)
    const current = expenseRows(scope).filter((row) => between(row.spent_on, from, to))
    const live = current.filter((row) => row.voided_at === null)
    const categories = [...new Set(live.map((row) => String(row.category)))]
    return HttpResponse.json({
      from,
      to,
      bucket: 'day',
      totals: expenseTotals(current),
      previous_totals: expenseTotals(
        expenseRows(scope).filter((row) => between(row.spent_on, ...previous)),
      ),
      by_category: categories.map((category) => ({
        category,
        amount: liveSum(
          live.filter((row) => row.category === category),
          'amount',
        ).toFixed(2),
      })),
      series: [{ start: from, amount: liveSum(live, 'amount').toFixed(2) }],
    })
  }),

  http.get('/api/v1/expenses/', ({ request }) => {
    const scope = guard(request, 'expense:view', true)
    if (scope instanceof Response) return scope
    const params = new URL(request.url).searchParams
    const from = params.get('spent_from') ?? '0000-01-01'
    const to = params.get('spent_to') ?? '9999-12-31'
    const rows = expenseRows(scope).filter(
      (row) => between(row.spent_on, from, to) && byParam(row, params, 'category'),
    )
    return paginate(request, rows)
  }),

  http.post('/api/v1/expenses/', async ({ request }) => {
    const scope = guard(request, 'expense:manage')
    if (scope instanceof Response) return scope
    const body = await bodyOf(request)
    const missing = required(body, ['category', 'amount', 'method'])
    if (missing !== null) return missing
    if (PAYROLL_CATEGORIES.includes(String(body.category)) && !seesPay(scope)) return forbidden()
    if (body.category === 'doctor_share' && (body.doctor === null || body.doctor === undefined)) {
      return validation({ doctor: 'required' })
    }
    const row = newExpense(scope, {
      ...body,
      doctor_name: staffNameOf(body.doctor),
      period:
        body.category === 'doctor_share'
          ? monthOf(String(body.spent_on ?? currentMonthKey()))
          : null,
    })
    table('expenses').unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),

  http.get('/api/v1/expenses/:id/', ({ request, params }) => {
    const scope = guard(request, 'expense:view', true)
    if (scope instanceof Response) return scope
    const row = expenseRows(scope).find((candidate) => candidate.id === params.id)
    return row === undefined ? notFound() : HttpResponse.json(row)
  }),

  voidAction('expenses', 'expenses', 'expense:void'),

  http.get('/api/v1/recurring-expenses/due/', ({ request }) => {
    const scope = guard(request, 'expense:view', true)
    if (scope instanceof Response) return scope
    const month = new URL(request.url).searchParams.get('month') ?? currentMonthKey()
    return HttpResponse.json(dueMonth(scope, month))
  }),

  http.post('/api/v1/recurring-expenses/:id/pay/', async ({ request, params }) => {
    const scope = guard(request, 'expense:manage')
    if (scope instanceof Response) return scope
    const template = findRow('recurring_expenses', params.id, scope)
    if (template === null) return notFound()
    const body = await bodyOf(request)
    const missing = required(body, ['month'])
    if (missing !== null) return missing
    const taken = table('expenses').some(
      (row) => row.recurring === template.id && row.period === body.month && row.voided_at === null,
    )
    if (taken) return validation({ month: 'already_paid' })
    const row = newExpense(scope, {
      category: template.category,
      payee: template.payee,
      amount: body.amount ?? template.amount,
      method: body.method ?? template.method,
      spent_on: body.spent_on,
      notes: body.notes ?? '',
      period: body.month,
      recurring: template.id,
    })
    table('expenses').unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),

  http.post('/api/v1/recurring-expenses/:id/skip/', async ({ request, params }) => {
    const scope = guard(request, 'expense:manage')
    if (scope instanceof Response) return scope
    const template = findRow('recurring_expenses', params.id, scope)
    if (template === null) return notFound()
    const body = await bodyOf(request)
    const missing = required(body, ['month'])
    if (missing !== null) return missing
    table('recurring_skips').push({
      id: newId(),
      clinic: scope.clinicId,
      recurring: template.id,
      period: body.month,
      reason: body.reason ?? '',
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/v1/recurring-expenses/:id/unskip/', async ({ request, params }) => {
    const scope = guard(request, 'expense:manage')
    if (scope instanceof Response) return scope
    const template = findRow('recurring_expenses', params.id, scope)
    if (template === null) return notFound()
    const body = await bodyOf(request)
    db.recurring_skips = table('recurring_skips').filter(
      (row) => !(row.recurring === template.id && row.period === body.month),
    )
    return new HttpResponse(null, { status: 204 })
  }),

  ...resource(
    'recurring-expenses',
    'recurring_expenses',
    { view: 'expense:view', manage: 'expense:manage' },
    {
      create: (body, scope) => {
        const missing = required(body, ['name', 'category', 'amount', 'method', 'day_of_month'])
        if (missing !== null) return missing
        if (PAYROLL_CATEGORIES.includes(String(body.category)) && !seesPay(scope)) {
          return forbidden()
        }
        return {
          payee: '',
          is_active: true,
          ...body,
          amount: Number(body.amount).toFixed(2),
          id: newId(),
          clinic: scope.clinicId,
          clinic_name: clinicNameOf(scope.clinicId),
        }
      },
      patch: (row, body) => {
        const { id: _id, clinic: _clinic, ...rest } = body
        Object.assign(row, rest)
        if (rest.amount !== undefined) row.amount = Number(rest.amount).toFixed(2)
      },
      remove: null,
    },
  ),

  // Off in the mock: a draft needs the real model, and a fake one would mislead.
  http.get('/api/v1/voice/status/', ({ request }) => {
    const scope = guard(request, 'voice:use')
    if (scope instanceof Response) return scope
    return HttpResponse.json({ enabled: false, used_this_month: 0, monthly_limit: 1500 })
  }),

  http.get('/api/v1/me/earnings/', ({ request }) => {
    // Not a read in all-branches mode: a doctor's month belongs to one branch.
    const scope = guard(request, 'payroll:view_own')
    if (scope instanceof Response) return scope
    const month = new URL(request.url).searchParams.get('month') ?? currentMonthKey()
    return HttpResponse.json(myEarnings(scope, month))
  }),

  http.get('/api/v1/payroll/', ({ request }) => {
    const scope = guard(request, 'payroll:view', true)
    if (scope instanceof Response) return scope
    const month = new URL(request.url).searchParams.get('month') ?? currentMonthKey()
    return HttpResponse.json(payrollRows(scope, month))
  }),

  http.post('/api/v1/payroll/pay/', async ({ request }) => {
    const scope = guard(request, 'payroll:manage')
    if (scope instanceof Response) return scope
    const body = await bodyOf(request)
    const missing = required(body, ['doctor', 'month', 'amount', 'method'])
    if (missing !== null) return missing
    const doctor = findRow('staff', body.doctor, scope)
    if (doctor === null || doctor.role !== 'doctor') return validation({ doctor: 'does_not_exist' })
    const row = newExpense(scope, {
      category: 'doctor_share',
      doctor: doctor.id,
      doctor_name: doctor.full_name,
      payee: doctor.full_name,
      amount: body.amount,
      method: body.method,
      spent_on: body.spent_on,
      notes: body.notes ?? '',
      period: body.month,
    })
    table('expenses').unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),

  ...resource(
    'compensations',
    'compensations',
    { view: 'payroll:view', manage: 'payroll:manage' },
    {
      filter: (row, params) => byParam(row, params, 'doctor'),
      create: (body, scope) => {
        const missing = required(body, ['doctor', 'base', 'effective_from'])
        if (missing !== null) return missing
        const doctor = findRow('staff', body.doctor, scope)
        if (doctor === null || doctor.role !== 'doctor') {
          return validation({ doctor: 'does_not_exist' })
        }
        return {
          ...body,
          percent: Number(body.percent ?? 0).toFixed(2),
          fixed: Number(body.fixed ?? 0).toFixed(2),
          id: newId(),
          clinic: scope.clinicId,
          doctor_name: doctor.full_name,
          created_by: membershipOf(scope.user),
          created_by_name: MOCK_USERS[scope.user].full_name,
          created_at: new Date().toISOString(),
        }
      },
      patch: null,
      remove: null,
    },
  ),

  http.get('/api/v1/reports/finance/', ({ request }) => {
    const scope = guard(request, 'report:view', true)
    if (scope instanceof Response) return scope
    const { from, to, previous } = rangeOf(request)
    return HttpResponse.json(financeOverview(scope, from, to, previous))
  }),

  http.get('/api/v1/reports/statistics/', ({ request }) => {
    const scope = guard(request, 'statistics:view', true)
    if (scope instanceof Response) return scope
    const { from, to, previous } = rangeOf(request)
    const asked = new URL(request.url).searchParams.get('doctor')
    let doctor: string | null
    if (!scope.permissions.includes('statistics:view_all')) {
      // A doctor's figures are their own, whatever they ask for.
      doctor = membershipOf(scope.user)
    } else if (asked === null) {
      doctor = null
    } else {
      const member = table('staff').find(
        (row) =>
          row.id === asked && row.role === 'doctor' && scope.clinicIds.includes(String(row.clinic)),
      )
      if (member === undefined) return validation({ doctor: 'does_not_exist' })
      doctor = asked
    }
    return HttpResponse.json(statisticsOverview(scope, from, to, previous, doctor))
  }),
]
