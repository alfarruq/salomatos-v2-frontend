/**
 * Synthetic data only — §16.3 forbids real patient data in fixtures.
 *
 * Shapes mirror the Django v2 contract (`/api/v1/…`): UUID ids, money as
 * decimal strings, tenant chosen by the `X-Clinic-Id` / `X-Organization-Id`
 * header, and the `{message, message_key, errors, exception_class}` error
 * envelope. A mock kinder than the server makes code pass tests it will fail
 * in production, so keep these honest.
 */

/** A structurally valid, deliberately unsigned JWT carrying simplejwt's `user_id`. */
function fakeAccessToken(userId: string): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ token_type: 'access', user_id: userId })}.not-a-real-signature`
}

/** Deterministic UUIDs so tests can name rows. */
export function mockId(kind: number, n: number): string {
  return `00000000-0000-4000-8${String(kind).padStart(3, '0')}-${String(n).padStart(12, '0')}`
}

export const MOCK_ORGANIZATION = { id: mockId(1, 1), name: 'Demo Dental' }

export const MOCK_CLINICS = {
  main: {
    id: mockId(2, 1),
    name: 'Chilonzor',
    phone_number: '+998712000001',
    address: 'Chilonzor 1',
    timezone: 'Asia/Tashkent',
    working_hours: {},
    is_active: true,
  },
  second: {
    id: mockId(2, 2),
    name: 'Yunusobod',
    phone_number: '+998712000002',
    address: 'Yunusobod 2',
    timezone: 'Asia/Tashkent',
    working_hours: {},
    is_active: true,
  },
} as const

const OWNER_PERMISSIONS = [
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
  'audit:view',
]
const DOCTOR_PERMISSIONS = [
  'clinic:view',
  'staff:view',
  'patient:view',
  'patient:manage',
  'appointment:view',
  'appointment:manage',
  'service:view',
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
  'payment:view',
]
const ADMIN_PERMISSIONS = OWNER_PERMISSIONS.filter(
  (p) => !['clinic:manage', 'staff:manage_owners', 'audit:view', 'payment:void'].includes(p),
)

export const MOCK_USERS = {
  /** Owns the organization: an owner membership in both branches. */
  owner: {
    id: mockId(3, 1),
    username: 'owner',
    full_name: 'Dilnoza Rahimova',
    phone_number: '+998901112233',
    email: 'owner@example.test',
    memberships: [
      {
        id: mockId(4, 1),
        clinic: { id: MOCK_CLINICS.main.id, name: MOCK_CLINICS.main.name },
        role: 'owner',
        permissions: OWNER_PERMISSIONS,
      },
      {
        id: mockId(4, 2),
        clinic: { id: MOCK_CLINICS.second.id, name: MOCK_CLINICS.second.name },
        role: 'owner',
        permissions: OWNER_PERMISSIONS,
      },
    ],
    organizations: [MOCK_ORGANIZATION],
  },
  admin: {
    id: mockId(3, 2),
    username: 'admin',
    full_name: 'Malika Tursunova',
    phone_number: '+998901112255',
    email: '',
    memberships: [
      {
        id: mockId(4, 3),
        clinic: { id: MOCK_CLINICS.main.id, name: MOCK_CLINICS.main.name },
        role: 'admin',
        permissions: ADMIN_PERMISSIONS,
      },
    ],
    organizations: [],
  },
  doctor: {
    id: mockId(3, 3),
    username: 'sardor',
    full_name: 'Sardor Usmonov',
    phone_number: '+998901112244',
    email: 'doctor@example.test',
    memberships: [
      {
        id: mockId(4, 4),
        clinic: { id: MOCK_CLINICS.main.id, name: MOCK_CLINICS.main.name },
        role: 'doctor',
        permissions: DOCTOR_PERMISSIONS,
      },
    ],
    organizations: [],
  },
  /** Valid credentials, no active clinic: the guard must turn them away. */
  orphan: {
    id: mockId(3, 4),
    username: 'orphan',
    full_name: 'Former Employee',
    phone_number: '',
    email: '',
    memberships: [],
    organizations: [],
  },
} as const

export type MockUserKey = keyof typeof MOCK_USERS

export function accessTokenFor(user: MockUserKey): string {
  return fakeAccessToken(MOCK_USERS[user].id)
}

/** Password for every mock account. Mock-only. */
export const MOCK_PASSWORD = 'salomat'

/** The envelope `apps/core/exceptions.py` puts around every failure. */
export function errorEnvelope({
  message,
  messageKey,
  errors = {},
  exceptionClass = 'BaseAPIException',
}: {
  message: string
  messageKey: string
  errors?: Record<string, unknown>
  exceptionClass?: string
}) {
  return { message, message_key: messageKey, errors, exception_class: exceptionClass }
}

const MAIN = MOCK_CLINICS.main
const DOCTOR_MEMBERSHIP = MOCK_USERS.doctor.memberships[0].id

export const MOCK_SPECIALTIES = [
  { id: mockId(5, 1), clinic: MAIN.id, name: 'Stomatolog' },
  { id: mockId(5, 2), clinic: MAIN.id, name: 'Ortodont' },
]

/** `StaffSerializer` rows. Ids are membership ids. */
export const MOCK_STAFF = [
  {
    id: DOCTOR_MEMBERSHIP,
    clinic: MAIN.id,
    username: 'sardor',
    full_name: 'Sardor Usmonov',
    phone_number: '+998901112244',
    email: 'doctor@example.test',
    role: 'doctor',
    is_active: true,
    specialty: mockId(5, 1),
    specialty_name: 'Stomatolog',
    experience_years: 7,
    biography: '',
  },
  {
    id: mockId(4, 5),
    clinic: MAIN.id,
    username: 'nodira',
    full_name: 'Nodira Karimova',
    phone_number: '+998901112266',
    email: '',
    role: 'doctor',
    is_active: true,
    specialty: mockId(5, 2),
    specialty_name: 'Ortodont',
    experience_years: 3,
    biography: '',
  },
  {
    id: MOCK_USERS.admin.memberships[0].id,
    clinic: MAIN.id,
    username: 'admin',
    full_name: 'Malika Tursunova',
    phone_number: '+998901112255',
    email: '',
    role: 'admin',
    is_active: true,
    specialty: null,
    specialty_name: null,
    experience_years: null,
    biography: '',
  },
]

export const MOCK_SERVICES = [
  {
    id: mockId(6, 1),
    clinic: MAIN.id,
    code: 'T01',
    name: 'Plomba',
    category: null,
    specialty: mockId(5, 1),
    price: '350000.00',
    duration_minutes: 45,
    is_active: true,
  },
  {
    id: mockId(6, 2),
    clinic: MAIN.id,
    code: 'T02',
    name: 'Tozalash',
    category: null,
    specialty: null,
    price: '200000.00',
    duration_minutes: 30,
    is_active: true,
  },
  {
    id: mockId(6, 3),
    clinic: MAIN.id,
    code: 'S01',
    name: 'Implantatsiya',
    category: null,
    specialty: null,
    price: '6000000.00',
    duration_minutes: 90,
    is_active: true,
  },
]

export const MOCK_PATIENTS = [
  {
    id: mockId(7, 1),
    clinic: MAIN.id,
    clinic_name: MAIN.name,
    full_name: 'Aziza Karimova',
    phone_number: '+998901000001',
    birth_date: '1990-04-12',
    gender: 'female',
    address: 'Chilonzor 5',
    notes: '',
    primary_doctor: DOCTOR_MEMBERSHIP,
    primary_doctor_name: 'Sardor Usmonov',
    archived_at: null,
    created_at: '2026-08-01T05:00:00Z',
  },
  {
    id: mockId(7, 2),
    clinic: MAIN.id,
    clinic_name: MAIN.name,
    full_name: 'Bekzod Aliyev',
    phone_number: '+998901000002',
    birth_date: '1985-11-02',
    gender: 'male',
    address: '',
    notes: '',
    primary_doctor: mockId(4, 5),
    primary_doctor_name: 'Nodira Karimova',
    archived_at: null,
    created_at: '2026-08-02T05:00:00Z',
  },
  {
    id: mockId(7, 3),
    clinic: MAIN.id,
    clinic_name: MAIN.name,
    full_name: 'Gulnora Yusupova',
    phone_number: '+998901000003',
    birth_date: null,
    gender: '',
    address: '',
    notes: '',
    primary_doctor: null,
    primary_doctor_name: null,
    archived_at: null,
    created_at: '2026-08-03T05:00:00Z',
  },
]

export const MOCK_APPOINTMENTS = [
  {
    id: mockId(8, 1),
    clinic: MAIN.id,
    clinic_name: MAIN.name,
    patient: mockId(7, 1),
    patient_name: 'Aziza Karimova',
    doctor: DOCTOR_MEMBERSHIP,
    doctor_name: 'Sardor Usmonov',
    chair: null,
    service: mockId(6, 1),
    start_at: '2026-08-24T05:00:00Z',
    end_at: '2026-08-24T05:45:00Z',
    status: 'scheduled',
    notes: '',
  },
]

export const MOCK_PROCEDURES = [
  {
    id: mockId(9, 1),
    clinic: MAIN.id,
    clinic_name: MAIN.name,
    patient: mockId(7, 1),
    patient_name: 'Aziza Karimova',
    doctor: DOCTOR_MEMBERSHIP,
    doctor_name: 'Sardor Usmonov',
    service: mockId(6, 1),
    service_name: 'Plomba',
    plan_item: null,
    appointment: null,
    tooth: 36,
    surfaces: ['O'],
    quantity: 1,
    unit_price: '350000.00',
    discount_percent: '0.00',
    total: '350000.00',
    performed_at: '2026-08-10T06:00:00Z',
    notes: '',
    voided_at: null,
    void_reason: '',
  },
]

export const MOCK_PAYMENTS = [
  {
    id: mockId(10, 1),
    clinic: MAIN.id,
    clinic_name: MAIN.name,
    patient: mockId(7, 1),
    patient_name: 'Aziza Karimova',
    amount: '150000.00',
    method: 'cash',
    paid_at: '2026-08-10T06:30:00Z',
    received_by: MOCK_USERS.admin.memberships[0].id,
    received_by_name: 'Malika Tursunova',
    notes: '',
    voided_at: null,
    void_reason: '',
  },
]

export const MOCK_PRESCRIPTIONS = [
  {
    id: mockId(11, 1),
    clinic: MAIN.id,
    clinic_name: MAIN.name,
    patient: mockId(7, 1),
    doctor: DOCTOR_MEMBERSHIP,
    doctor_name: 'Sardor Usmonov',
    notes: '',
    items: [
      {
        id: mockId(12, 1),
        medicine: 'Ibuprofen',
        dose: '400 mg',
        form: 'tabletka',
        times_per_day: 2,
        duration_days: 3,
        meal_relation: 'after',
        instructions: '',
      },
    ],
    created_at: '2026-08-10T06:10:00Z',
  },
]
