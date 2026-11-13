# SalomatOS — Frontend Arxitekturasi

> **Versiya:** 1.0
> **Oxirgi yangilanish:** 2026-07-30
> **Status:** Faol (living document)
> **Backend:** Django 5 + Django REST Framework (alohida repozitoriy)

---

## 0. Bu hujjat haqida

Bu fayl — SalomatOS frontend qismining **yagona haqiqat manbai** (single source of truth).

**Kim uchun:**
- Loyihaga qo'shilgan yangi dasturchi — birinchi kuni shu faylni o'qiydi.
- AI yordamchisi (Claude / Cursor / Copilot) — har bir sessiyada bu fayl kontekstga kiritiladi.
- Code review qiluvchi — "bu to'g'rimi?" degan savolga shu yerdan javob topadi.

**Qoidalar:**
1. Bu hujjatda yozilgan qoida — **majburiy**, taklif emas.
2. Qoidani buzish kerak bo'lsa — avval hujjat o'zgartiriladi, keyin kod. Teskarisi emas.
3. Har bir katta qaror `§18 ADR` bo'limida sabab bilan yozilgan. "Nega bunday?" degan savolga o'sha yerda javob bor.
4. Hujjat kod bilan bir PR'da yangilanadi. Eskirgan hujjat — hujjat yo'qligidan yomonroq.

**AI bilan ishlashda:** har bir yangi sessiya boshida shu faylni ko'rsating. Aks holda 3 xil modulda 3 xil arxitektura paydo bo'ladi — bu "vibe coding"ning eng katta xavfi.

---

## 1. Tizim konteksti va deployment

### 1.1. Umumiy manzara

SalomatOS — **ko'p ijarachili (multi-tenant) SaaS**. 1000+ klinika bitta tizimda ishlaydi, har biri o'z ma'lumotini ko'radi.

Frontend — **sof SPA** (Vite + React), Django REST API bilan ishlaydi.

### 1.2. Deployment: bitta origin (same-origin) — MAJBURIY

Bu eng muhim infratuzilma qarori. SPA va API **bitta domendan** xizmat qiladi:

```
                    ┌─────────────────────────────┐
   Brauzer ────────▶│  nginx (app.salomatos.uz)   │
                    ├─────────────────────────────┤
                    │  /api/*  ──▶ Django (:8000) │
                    │  /*      ──▶ dist/ (statik) │
                    └─────────────────────────────┘
```

```nginx
server {
    listen 443 ssl http2;
    server_name app.salomatos.uz;

    # API — Django'ga
    location /api/ {
        proxy_pass http://django:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Media (rentgen, skanlar) — X-Accel-Redirect orqali, Django ruxsatni tekshirgandan keyin
    location /protected-media/ {
        internal;
        alias /var/salomatos/media/;
    }

    # SPA — statik fayllar
    location /assets/ {
        root /var/www/salomatos;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        root /var/www/salomatos;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";   # index.html hech qachon keshlanmasin
    }
}
```

**Nega bu shunchalik muhim:**

| Foyda | Tushuntirish |
|---|---|
| **CORS yo'q** | `Access-Control-Allow-Credentials`, preflight so'rovlar, `withCredentials` — hech biri kerak emas. Kamroq kod, kamroq xato, kamroq zaiflik. |
| **Birinchi tomon cookie** | `SameSite=Strict` ishlatish mumkin. Uchinchi tomon cookie cheklovlari (Safari ITP, Chrome) ta'sir qilmaydi. |
| **CSRF yuzasi kichik** | `SameSite=Strict` + CSRF token = ikki qatlamli himoya. |
| **Node runtime yo'q** | Deploy = `dist/` papkani nusxalash. Server yo'q, xotira yo'q, CVE yuzasi yo'q. |

> ⛔ **Taqiqlangan:** frontend `app.salomatos.uz`, API `api.salomatos.uz` sxemasi. Bu CORS + cross-site cookie muammolarini keltiradi va tibbiy ma'lumot uchun xavfsizlik darajasini pasaytiradi. Agar bu sxema majburiy bo'lsa — `§18 ADR-002`ni qayta ko'rib chiqing.

### 1.3. Ommaviy sahifalar (Bemor uchun) — SEO'siz strategiya

SPA'da SEO yo'q. Bu **ongli qaror**, kamchilik emas (`ADR-001`).

| Ehtiyoj | Yechim |
|---|---|
| Bemorga navbat tasdig'i | SMS/Telegram orqali kelgan **imzolangan qisqa link** (`/b/<signed-token>`). Google indeksatsiyasi kerak emas. |
| Klinika sahifasi (ommaviy) | Django tomonda oddiy shablon (server-rendered) yoki keyinchalik alohida statik sayt. |
| Marketing sayti | **Alohida loyiha** — Astro/statik, `salomatos.uz` domenida. Ilova `app.salomatos.uz`da qoladi. |

Bu ajratish to'g'ri: marketing sayti va tibbiy panel butunlay boshqa talablarga ega. Ularni bitta kodbazaga tiqish — sun'iy murakkablik.

---

## 2. Tech Stack

Versiyalar 2026-yil iyul holatiga. **Major versiyani o'zgartirish — ADR talab qiladi.**

### 2.1. Yadro

| Paket | Versiya | Rol |
|---|---|---|
| `react` / `react-dom` | `^19.2` | UI kutubxonasi |
| `typescript` | `^5.9` | Tiplar. `strict: true` majburiy |
| `vite` | `^7` | Build tool |
| `@tanstack/react-router` | `^1` | Routing (tip-xavfsiz) |
| `@tanstack/react-query` | `^5.101` | Server state |
| `zustand` | `^5` | Client state |
| `valibot` | `^1` | Runtime validatsiya (`ADR-011` — Zod o'rniga) |
| `react-hook-form` | `^7.80` | Formalar |
| `@hookform/resolvers` | `^5` | RHF ↔ Valibot ko'prigi |

> **Eslatma:** React uchun TanStack Query hamon **v5**. Internetdagi "v6" — Svelte adapteri, ichida baribir v5 core ishlaydi. Adashmang.

### 2.2. UI

| Paket | Versiya | Rol |
|---|---|---|
| `tailwindcss` | `^4.3` | Styling (CSS-first, `@theme`) |
| `@tailwindcss/vite` | `^4.3` | Vite plugin (PostCSS emas) |
| shadcn/ui | — | Komponentlar (kodga nusxalanadi, dependency emas) |
| `@radix-ui/*` | latest | Accessibility primitivlari |
| `motion` | `^12` | Animatsiya (eski nomi `framer-motion`) |
| `@tanstack/react-table` | `^8` | Jadval mantiqi (headless) |
| `@tanstack/react-virtual` | `^3` | Virtualizatsiya |
| `lucide-react` | latest | Ikonkalar |
| `sonner` | latest | Toast |
| `cmdk` | latest | ⌘K command palette |

### 2.3. Infratuzilma

| Paket | Rol |
|---|---|
| `orval` | OpenAPI → TS tiplar + React Query hooklar + MSW mocklar |
| `i18next` + `react-i18next` | Ko'p tillilik |
| `nuqs` | URL state (TanStack Router adapteri bilan) |
| `date-fns` + `@date-fns/tz` | Sana/vaqt |
| `ky` | HTTP klient (fetch ustida, yengil) |

### 2.4. Tooling

| Vosita | Rol |
|---|---|
| `pnpm` | Paket menejeri. **npm/yarn ishlatilmaydi** — `pnpm-lock.yaml` yagona lockfile |
| `biome` | Lint + format (ESLint + Prettier o'rniga, ~20x tez) |
| `eslint-plugin-boundaries` | Qatlamlar orasidagi importni nazorat qiladi (`§3.3`) |
| `vitest` + `@testing-library/react` | Unit/komponent testlari |
| `msw` | API mocklari (Orval generatsiya qiladi) |
| `playwright` | E2E |
| `husky` + `lint-staged` | Pre-commit |
| `rollup-plugin-visualizer` | Bundle tahlili |

### 2.5. Ishlatilmaydigan texnologiyalar (va nega)

| Texnologiya | Nega yo'q |
|---|---|
| Redux / RTK | State'ning 85% i server state. TanStack Query buni yaxshiroq hal qiladi. Qolgan 15% uchun Redux ortiqcha. |
| MUI / Ant Design / Chakra | O'z dizayn tilini olib keladi. "Apple-style"ga keltirish uchun har bir komponentni override qilish kerak — eng qimmat yo'l. |
| `axios` | `ky` yengilroq va zamonaviy fetch ustida. Interceptor'lar (`hooks`) yetarli. |
| `moment.js` | Deprecated, og'ir, mutable. |
| CSS-in-JS (styled-components, emotion) | Runtime narxi. Tailwind v4 build-time ishlaydi. |
| `localStorage` token uchun | `§13.2` — xavfsizlik sababi. |

---

## 3. Papka strukturasi va qatlamlar

### 3.1. Struktura

Feature-Sliced Design'ning soddalashtirilgan varianti:

```
src/
├── app/                          # Ilova qobig'i
│   ├── providers/                # QueryClient, Router, i18n, Theme
│   ├── router.tsx                # Router konfiguratsiyasi
│   └── main.tsx                  # Entry point
│
├── pages/                        # Route komponentlari (TanStack Router file-based)
│   ├── __root.tsx
│   ├── _auth/                    # Guard'li layout
│   │   ├── patients/
│   │   │   ├── index.tsx         # /patients
│   │   │   └── $patientId.tsx    # /patients/:patientId
│   │   └── appointments/
│   └── login.tsx
│
├── widgets/                      # Sahifa bloklari (bir nechta feature'dan yig'iladi)
│   ├── app-sidebar/
│   ├── patient-table/
│   └── appointment-calendar/
│
├── features/                     # Foydalanuvchi HARAKATLARI (fe'l)
│   ├── patient-create/
│   ├── patient-archive/
│   ├── appointment-reschedule/
│   └── auth-login/
│
├── entities/                     # Biznes OBYEKTLARI (ot)
│   ├── patient/
│   │   ├── api/                  # queryOptions, mutations, query keys
│   │   ├── model/                # tiplar, validatsiya schema'si, mapper'lar
│   │   └── ui/                   # PatientAvatar, PatientStatusBadge
│   ├── appointment/
│   ├── clinic/
│   └── session/                  # joriy foydalanuvchi + permissions
│
└── shared/                       # Biznes mantiqidan xoli
    ├── ui/                       # Dizayn tizimi (shadcn) — Button, Input, Switch...
    ├── api/                      # http klient, generated/, error normalizer
    ├── lib/                      # utils, hooks (useDebounce, useIdleTimer)
    ├── config/                   # env, konstantalar, cache siyosati
    └── i18n/                     # i18next setup
```

### 3.2. `features` vs `entities` — chegara qayerda?

Bu eng ko'p adashiladigan joy. Oddiy test:

- **Entity** — bu **ot**. "Bemor", "Uchrashuv", "Klinika". Uni ko'rsatish, tipini bilish, API'dan olish.
- **Feature** — bu **fe'l**. "Bemor yaratish", "Uchrashuvni ko'chirish", "Tizimga kirish". Foydalanuvchi bajaradigan aniq amal.

```
entities/patient/ui/PatientStatusBadge.tsx   ✅ (bemor holatini ko'rsatadi)
entities/patient/ui/PatientDeleteButton.tsx  ❌ (bu amal → features/patient-archive/)

features/patient-create/ui/CreatePatientDialog.tsx  ✅
features/patient-create/model/schema.ts             ✅
```

**Qoida:** entity — passiv, feature — aktiv. Entity mutation yozmaydi (faqat query). Mutation har doim feature'da.

### 3.3. Import qoidalari — ESLint bilan majburlanadi

Importlar **faqat pastga** yo'nalgan:

```
app → pages → widgets → features → entities → shared
```

- `shared` hech kimni import qilmaydi.
- `entities` faqat `shared`ni.
- `features` — `entities` + `shared`.
- Bir xil qatlamdagi ikkita slice bir-birini import qilolmaydi (`features/patient-create` → `features/auth-login` ❌).

```js
// biome.json / eslint.config.js
{
  "plugins": ["boundaries"],
  "settings": {
    "boundaries/elements": [
      { "type": "app",      "pattern": "src/app/*" },
      { "type": "pages",    "pattern": "src/pages/*" },
      { "type": "widgets",  "pattern": "src/widgets/*" },
      { "type": "features", "pattern": "src/features/*" },
      { "type": "entities", "pattern": "src/entities/*" },
      { "type": "shared",   "pattern": "src/shared/*" }
    ]
  },
  "rules": {
    "boundaries/element-types": ["error", {
      "default": "disallow",
      "rules": [
        { "from": "app",      "allow": ["pages", "widgets", "features", "entities", "shared"] },
        { "from": "pages",    "allow": ["widgets", "features", "entities", "shared"] },
        { "from": "widgets",  "allow": ["features", "entities", "shared"] },
        { "from": "features", "allow": ["entities", "shared"] },
        { "from": "entities", "allow": ["shared"] },
        { "from": "shared",   "allow": ["shared"] }
      ]
    }]
  }
}
```

**Nega bu majburlanadi:** 6 oydan keyin hech kim qoidani eslamaydi. Linter esladi. Qoida faqat CI'da tekshirilgandagina qoida bo'lib qoladi.

### 3.4. Public API (`index.ts`)

Har bir slice o'z `index.ts` faylini eksport qiladi. Tashqaridan **faqat shu fayl** orqali import qilinadi:

```ts
// entities/patient/index.ts
export { patientKeys, patientQueries } from './api/queries'
export { PatientStatusBadge } from './ui/PatientStatusBadge'
export type { Patient, PatientStatus } from './model/types'
```

```ts
import { PatientStatusBadge } from '@/entities/patient'              // ✅
import { PatientStatusBadge } from '@/entities/patient/ui/PatientStatusBadge'  // ❌
```

Bu refaktoring erkinligini beradi: ichki strukturani xohlagancha o'zgartirasiz, tashqi kontrakt buzilmaydi.

---

## 4. Nomlash konvensiyalari

| Nima | Uslub | Misol |
|---|---|---|
| Papka | `kebab-case` | `patient-create/`, `appointment-calendar/` |
| React komponent fayli | `PascalCase.tsx` | `PatientTable.tsx` |
| Hook fayli | `camelCase.ts` | `usePatientFilters.ts` |
| Boshqa `.ts` fayllar | `camelCase.ts` | `queryKeys.ts`, `formatPhone.ts` |
| Tip / Interface | `PascalCase` | `Patient`, `AppointmentStatus` |
| Validatsiya schema'si | `camelCase` + `Schema` | `createPatientSchema` |
| Konstanta | `SCREAMING_SNAKE` | `IDLE_TIMEOUT_MS` |
| Boolean o'zgaruvchi | `is/has/can` prefiksi | `isLoading`, `canEditPatient` |
| Event handler | `handle` prefiksi | `handleSubmit` |
| Handler prop | `on` prefiksi | `onSuccess` |

**Til qoidasi:** kod, kommentariya, commit — **ingliz tilida**. Faqat foydalanuvchiga ko'rinadigan matn tarjima fayllarida bo'ladi. Aralash til (`const bemorlar = []`) qat'iy taqiqlanadi.

---

## 5. API qatlami

### 5.1. Tiplar qo'lda yozilmaydi

Backend `drf-spectacular` orqali OpenAPI 3 schema beradi. Frontend uni Orval bilan kodga aylantiradi.

```ts
// orval.config.ts
import { defineConfig } from 'orval'

export default defineConfig({
  salomatos: {
    input: {
      target: process.env.OPENAPI_URL ?? 'http://localhost:8000/api/schema/',
    },
    output: {
      mode: 'tags-split',
      target: './src/shared/api/generated',
      schemas: './src/shared/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      override: {
        mutator: {
          path: './src/shared/api/httpClient.ts',
          name: 'httpClient',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          signal: true,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'biome format --write',
    },
  },
})
```

```jsonc
// package.json
"scripts": {
  "api:generate": "orval",
  "api:check": "orval && git diff --exit-code src/shared/api/generated"
}
```

`api:check` CI'da ishlaydi. Backend schema o'zgarsa-yu, frontend tiplari yangilanmasa — **build yiqiladi**. Bemor kartochkasi productionda bo'sh chiqishidan ko'ra, CI'da qizil ko'rinishi ancha arzon.

> ⚠️ `src/shared/api/generated/` — **qo'lda tahrirlanmaydi**. `.gitattributes`da `linguist-generated=true` deb belgilangan, review'da diff yig'ilgan holda ko'rinadi.

### 5.2. HTTP klient

```ts
// shared/api/httpClient.ts
import ky, { HTTPError } from 'ky'
import { ApiError, normalizeDrfError } from './errors'

let refreshPromise: Promise<void> | null = null

export const api = ky.create({
  prefixUrl: '/api',              // same-origin — absolute URL kerak emas
  credentials: 'same-origin',     // httpOnly cookie avtomatik ketadi
  timeout: 20_000,
  retry: {
    limit: 2,
    methods: ['get'],             // faqat GET qayta urinadi. POST hech qachon.
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        // Django CSRF
        const method = request.method.toUpperCase()
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
          const csrf = getCookie('csrftoken')
          if (csrf) request.headers.set('X-CSRFToken', csrf)
        }
        // Tenant konteksti — backend ham buni tekshiradi
        const clinicId = useSessionStore.getState().activeClinicId
        if (clinicId) request.headers.set('X-Clinic-Id', clinicId)
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status !== 401) return response

        // Parallel 401'larda faqat BITTA refresh so'rovi ketsin
        refreshPromise ??= refreshSession().finally(() => { refreshPromise = null })

        try {
          await refreshPromise
          return ky(request, options)          // takrorlash
        } catch {
          hardLogout()                          // refresh ham o'lgan
          return response
        }
      },
    ],
  },
})

export async function httpClient<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    return await api(url, options as never).json<T>()
  } catch (error) {
    if (error instanceof HTTPError) throw await normalizeDrfError(error)
    throw new ApiError({ kind: 'network', message: 'network_error' })
  }
}
```

### 5.3. Xatolarni normalizatsiya qilish

DRF xatolarni kamida 4 xil shaklda qaytaradi. UI hech qachon xom xatoni ko'rmaydi:

```ts
// shared/api/errors.ts
export type ApiErrorKind =
  | 'validation'    // 400 — maydon xatolari
  | 'unauthorized'  // 401
  | 'forbidden'     // 403 — ruxsat yo'q
  | 'notFound'      // 404
  | 'conflict'      // 409 — masalan, vaqt band
  | 'rateLimited'   // 429
  | 'server'        // 5xx
  | 'network'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  /** Maydon nomi → tarjima kaliti. RHF'ga to'g'ridan-to'g'ri beriladi. */
  readonly fieldErrors: Record<string, string[]>
  readonly detail?: string
  readonly requestId?: string   // Django log bilan bog'lash uchun

  // ...
}

export async function normalizeDrfError(error: HTTPError): Promise<ApiError> {
  const { status } = error.response
  const body = await error.response.json().catch(() => ({}))

  // DRF: { "field": ["xato"] } | { "detail": "..." } | { "non_field_errors": [...] }
  const fieldErrors: Record<string, string[]> = {}
  let detail: string | undefined

  if (typeof body === 'object' && body !== null) {
    for (const [key, value] of Object.entries(body)) {
      if (key === 'detail') detail = String(value)
      else if (Array.isArray(value)) fieldErrors[key] = value.map(String)
    }
  }

  return new ApiError({ kind: kindFromStatus(status), fieldErrors, detail,
    requestId: error.response.headers.get('X-Request-Id') ?? undefined })
}
```

> ⛔ **Muhim:** `ApiError`da bemor ma'lumoti bo'lmasligi kerak. Backend xato matnida ism/telefon qaytarmasin — bu Sentry'ga tushadi (`§13.4`).

### 5.4. Backend bilan kontrakt

Backend jamoasidan talab qilinadigan minimal shartlar:

| Talab | Sabab |
|---|---|
| `drf-spectacular` bilan to'liq schema, har bir endpoint `@extend_schema` bilan hujjatlangan | Kod generatsiyasi |
| Barcha ID — `UUID` | Ketma-ket integer ID enumeratsiya hujumiga ochiq (`/patients/1`, `/patients/2`...) |
| Sana/vaqt — **UTC, ISO-8601** (`2026-07-30T09:00:00Z`) | `§12.4` |
| Katta ro'yxatlar — `CursorPagination` | `OFFSET 50000` PostgreSQL'ni o'ldiradi |
| Har bir javobda `X-Request-Id` | Frontend xatosini backend logi bilan bog'lash |
| Xato matnida PHI yo'q | `§13.4` |
| `/api/me/` — foydalanuvchi + `permissions[]` + `clinics[]` qaytaradi | `§9` |

---

## 6. Server state — TanStack Query

### 6.1. Query key factory — MAJBURIY namuna

Query key'lar hech qachon "inline" yozilmaydi. Har bir entity o'z factory'siga ega:

```ts
// entities/patient/api/queries.ts
import { queryOptions, infiniteQueryOptions } from '@tanstack/react-query'
import { cachePolicy } from '@/shared/config/cache'

export const patientKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'patients'] as const,

  list: (clinicId: string, filters: PatientFilters) =>
    [...patientKeys.scope(clinicId), 'list', filters] as const,

  detail: (clinicId: string, patientId: string) =>
    [...patientKeys.scope(clinicId), 'detail', patientId] as const,

  timeline: (clinicId: string, patientId: string) =>
    [...patientKeys.detail(clinicId, patientId), 'timeline'] as const,
}

export const patientQueries = {
  list: (clinicId: string, filters: PatientFilters) =>
    infiniteQueryOptions({
      queryKey: patientKeys.list(clinicId, filters),
      queryFn: ({ pageParam, signal }) =>
        fetchPatients({ cursor: pageParam, ...filters }, signal),
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.next,
      ...cachePolicy.standard,
    }),

  detail: (clinicId: string, patientId: string) =>
    queryOptions({
      queryKey: patientKeys.detail(clinicId, patientId),
      queryFn: ({ signal }) => fetchPatient(patientId, signal),
      ...cachePolicy.standard,
    }),
}
```

### 6.2. 🔴 Multi-tenancy — eng muhim qoida

> **`clinicId` HAR DOIM query key'ning ichida bo'ladi. Istisnosiz.**

Sabab: foydalanuvchi (masalan, bir nechta filialda ishlaydigan shifokor) klinikani almashtirganda, key'da `clinicId` bo'lmasa — TanStack Query eski klinikaning keshlangan bemorlarini ko'rsatadi.

Bu **bug emas, ma'lumot sizib chiqishi (data leak)**. Tibbiy tizimda bu huquqiy oqibatlarga olib keladi.

Klinika almashganda qo'shimcha himoya:

```ts
// features/clinic-switch/model/useSwitchClinic.ts
export function useSwitchClinic() {
  const qc = useQueryClient()
  return useCallback((nextClinicId: string) => {
    qc.clear()                                    // butun keshni tozalash
    useSessionStore.getState().setClinic(nextClinicId)
    router.navigate({ to: '/dashboard' })
  }, [qc])
}
```

### 6.3. Kesh siyosati — ma'lumot turiga qarab

Hamma narsaga bir xil `staleTime` qo'yish — eng keng tarqalgan xato.

```ts
// shared/config/cache.ts
export const cachePolicy = {
  /** Deyarli o'zgarmaydi: xizmatlar, tish sxemasi, ro'llar, davlat ma'lumotnomalari */
  static: {
    staleTime: 60 * 60 * 1000,       // 1 soat
    gcTime: 2 * 60 * 60 * 1000,
  },

  /** O'rtacha: bemorlar, shifokorlar, xizmat narxlari */
  standard: {
    staleTime: 5 * 60 * 1000,        // 5 daqiqa
    gcTime: 10 * 60 * 1000,
  },

  /** Tez o'zgaradi: bugungi jadval, navbat holati, bo'sh vaqtlar */
  live: {
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  },

  /** Hech qachon keshlanmaydi: to'lov holati, bir martalik tokenlar */
  never: {
    staleTime: 0,
    gcTime: 0,
  },
} as const
```

**Nega bu muhim:** registratura ekranida bugungi jadval eskirgan bo'lsa — ikki bemor bir vaqtga yoziladi. Xizmatlar ro'yxati har 30 soniyada so'ralsa — 1000 klinikada Django'ga behuda 2000 req/min.

### 6.4. Global QueryClient

```ts
// app/providers/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...cachePolicy.standard,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // Mijoz xatosini qayta urinish — behuda
          if (['unauthorized', 'forbidden', 'notFound', 'validation'].includes(error.kind)) {
            return false
          }
        }
        return failureCount < 2
      },
      throwOnError: (error) =>
        error instanceof ApiError && error.kind === 'server',   // ErrorBoundary ushlaydi
    },
    mutations: {
      retry: false,                  // mutation HECH QACHON avtomatik takrorlanmaydi
      onError: (error) => showErrorToast(error),
    },
  },
})
```

> ⛔ **Query keshini `localStorage`ga persist qilish TAQIQLANADI.** `persistQueryClient` ishlatilmaydi. Sabab: umumiy kompyuterda (registratura stoli) keyingi xodim brauzer xotirasidan bemor bazasini o'qiy oladi. Kesh faqat RAM'da yashaydi.

### 6.5. Optimistic update — uchrashuv ko'chirish

Kalendarda uchrashuvni sudrab ko'chirganda foydalanuvchi 300ms kutmasligi kerak:

```ts
// features/appointment-reschedule/model/useRescheduleAppointment.ts
export function useRescheduleAppointment(clinicId: string, date: string) {
  const qc = useQueryClient()
  const key = appointmentKeys.day(clinicId, date)

  return useMutation({
    mutationFn: rescheduleAppointment,

    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<AppointmentDay>(key)
      qc.setQueryData<AppointmentDay>(key, (old) => old && applyReschedule(old, input))
      return { previous }
    },

    onError: (error, _input, context) => {
      qc.setQueryData(key, context?.previous)     // rollback
      if (error instanceof ApiError && error.kind === 'conflict') {
        toast.error(t('appointment.slotTaken'))
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })     // server bilan sinxronlash
    },
  })
}
```

**Qoida:** optimistic update faqat **teskari qaytariladigan (reversible)** amallarda ishlatiladi. To'lov, retsept yozish, tibbiy yozuvni yakunlash — bularda optimistic ishlatilmaydi, foydalanuvchi tasdiqni kutadi.

### 6.6. Real-time — Django Channels

Bir nechta administrator bir vaqtda ishlaydi. Konflikt bo'lmasligi uchun WebSocket:

```ts
// shared/lib/realtime.ts
socket.on('invalidate', ({ scope, clinicId, entityId }) => {
  switch (scope) {
    case 'appointments:day':
      queryClient.invalidateQueries({ queryKey: appointmentKeys.day(clinicId, entityId) })
      break
    case 'patient':
      queryClient.invalidateQueries({ queryKey: patientKeys.detail(clinicId, entityId) })
      break
  }
})
```

> **Arxitektura qoidasi:** WebSocket **ma'lumot tashimaydi**, faqat "yangilan" signalini beradi. Sabablari:
> 1. PHI WebSocket kanali orqali oqmaydi (kamroq audit yuzasi).
> 2. Avtorizatsiya bitta joyda qoladi — REST endpoint'da.
> 3. Ikki xil ma'lumot manbasi (REST + WS) sinxrondan chiqmaydi.

Agar Channels hozircha og'irlik qilsa — `cachePolicy.live` (30s polling) bilan boshlang. Migratsiya og'riqsiz, chunki chaqiruv joyi bir xil.

---

## 7. Client state

### 7.1. Toifalar

| Turi | Vosita | Misol |
|---|---|---|
| Server state | TanStack Query | Bemorlar, uchrashuvlar |
| Global client | Zustand | Sessiya, aktiv klinika, tema, sidebar |
| URL state | `nuqs` / route search | Filtrlar, sahifa, qidiruv, sana |
| Local | `useState` | Modal ochiqmi, input focus |

### 7.2. Zustand — faqat kerakli narsalar

```ts
// entities/session/model/sessionStore.ts
interface SessionState {
  user: SessionUser | null
  activeClinicId: string | null
  permissions: ReadonlySet<Permission>
  status: 'loading' | 'authenticated' | 'anonymous'
}

export const useSessionStore = create<SessionState & SessionActions>()((set) => ({
  user: null,
  activeClinicId: null,
  permissions: new Set(),
  status: 'loading',

  setSession: (user, clinicId) => set({
    user,
    activeClinicId: clinicId,
    permissions: new Set(user.permissions),
    status: 'authenticated',
  }),

  clear: () => set({
    user: null, activeClinicId: null,
    permissions: new Set(), status: 'anonymous',
  }),
}))
```

**Zustand'ga NIMA QO'YILMAYDI:**
- ❌ Server ma'lumoti (bemorlar ro'yxati va h.k.) — bu Query'ning ishi
- ❌ Forma qiymatlari — bu RHF'ning ishi
- ❌ Jadval filtrlari — bu URL'ning ishi

Agar Zustand store 100 qatordan oshsa — nimadir noto'g'ri.

Selector'dan foydalaning, butun store'ni obuna qilmang:

```ts
const clinicId = useSessionStore((s) => s.activeClinicId)   // ✅
const store = useSessionStore()                              // ❌ har o'zgarishda re-render
```

### 7.3. URL state — jadval filtrlari

Filtrlar `useState`da emas, URL'da yashaydi:

```tsx
// pages/_auth/patients/index.tsx
export const Route = createFileRoute('/_auth/patients/')({
  validateSearch: (search) => v.parse(patientFiltersSchema, search),   // tip-xavfsiz
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureInfiniteQueryData(
      patientQueries.list(context.clinicId, deps)
    ),
  component: PatientsPage,
})
```

**Nega:** administrator hamkasbiga link tashlay olishi kerak. Sahifa yangilanganda filtr yo'qolmasligi kerak. "Orqaga" tugmasi ishlashi kerak. Bu professional SaaS'ning belgisi.

> ⛔ **Qat'iy qoida:** URL'da shaxsiy ma'lumot bo'lmaydi.
> `?q=Aliyev+Vali` ❌ — server logiga, `Referer` header'iga, brauzer tarixiga tushadi
> `?patient=550e8400-e29b-...` ✅
>
> Qidiruv matni — POST orqali yoki debounce bilan, URL'ga yozilmasdan. Buning uchun `patientFiltersSchema`da `q` maydoni **yo'q**; qidiruv `useState` + `useDebounce` orqali ishlaydi.

---

## 8. Routing va autentifikatsiya

### 8.1. TanStack Router — nega

Sof client-heavy panel uchun TanStack Router'ning tip-xavfsizligi tengsiz: path parametrlari, search parametrlari va loader ma'lumoti **avtomatik** tiplanadi. `navigate({ to: '/patients/$id' })` da bitta xato harf — TypeScript xatosi, runtime 404 emas.

### 8.2. Auth guard — layout darajasida

```tsx
// pages/_auth.tsx  — barcha himoyalangan sahifalar shu layout ostida
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueries.me())

    if (!session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (session.clinics.length === 0) {
      throw redirect({ to: '/onboarding' })
    }

    return { session, clinicId: session.activeClinicId }
  },
  component: AuthenticatedLayout,
})
```

Guard **bitta joyda**. Har bir sahifada takrorlanmaydi.

> ⚠️ Bu guard — faqat UX. Haqiqiy himoya `§9`da.

### 8.3. Code splitting

TanStack Router file-based routing avtomatik `lazy` chunk yaratadi. Qo'shimcha:

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-query': ['@tanstack/react-query'],
        'vendor-charts': ['recharts'],       // faqat hisobotlar sahifasida kerak
      },
    },
  },
}
```

---

## 9. RBAC (Rollar va ruxsatlar)

### 9.1. 🔴 Asosiy tamoyil

> **Frontend hech narsani himoya qilmaydi. Frontend faqat foydalanuvchiga bosa olmaydigan tugmani ko'rsatmaydi.**

Frontend'dagi rol tekshiruvi DevTools'da 5 soniyada aylanib o'tiladi. Haqiqiy avtorizatsiya — **faqat** Django tomonda:
- `permission_classes` har bir ViewSet'da
- **Har bir queryset `filter(clinic=request.user.active_clinic)` bilan boshlanadi**

Ikkinchi punkt eng muhimi. Object-level ruxsatni unutish — 1000 klinikali tizimda katastrofa.

### 9.2. Frontend tomonda

```ts
// entities/session/model/permissions.ts
export type Permission =
  | 'patient:read' | 'patient:write' | 'patient:archive'
  | 'appointment:read' | 'appointment:write'
  | 'medical-record:read' | 'medical-record:write'
  | 'billing:read' | 'billing:write'
  | 'clinic:manage' | 'staff:manage'

export function useCan(permission: Permission): boolean {
  return useSessionStore((s) => s.permissions.has(permission))
}
```

```tsx
// shared/ui/Can.tsx
export function Can({ permission, fallback = null, children }: CanProps) {
  return useCan(permission) ? <>{children}</> : <>{fallback}</>
}
```

```tsx
<Can permission="patient:archive">
  <ArchivePatientButton patientId={patient.id} />
</Can>
```

> **Qoida:** ruxsat ro'yxati `/api/me/` dan keladi. Frontend'da rol → ruxsat xaritasi **hardcode qilinmaydi**. Aks holda backend'da ruxsat o'zgarganda frontend yolg'on gapiradi.

### 9.3. Rollar (ma'lumot uchun)

| Rol | Ko'lam |
|---|---|
| `SuperAdmin` | Barcha klinikalar, platforma sozlamalari |
| `ClinicAdmin` | Bitta klinika: xodimlar, narxlar, hisobotlar |
| `Doctor` | O'z bemorlari, tibbiy yozuvlar, o'z jadvali |
| `Patient` | Faqat o'zining ma'lumoti va navbatlari |

`Patient` roli — **alohida route daraxti** (`/portal/*`), butunlay boshqa layout. Uni admin panel bilan aralashtirmang: xato ruxsat = bemor boshqa bemorni ko'radi.

---

## 10. Formalar va validatsiya

### 10.1. Namuna

```tsx
// features/patient-create/model/schema.ts
import * as v from 'valibot'   // ADR-011

export const createPatientSchema = v.object({
  firstName: v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort'), v.maxLength(60)),
  lastName:  v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort'), v.maxLength(60)),
  phone:     v.pipe(v.string(), v.regex(/^\+998\d{9}$/, 'validation.phoneUz')),
  birthDate: v.pipe(v.string(), v.check(notInFuture, 'validation.birthDateFuture')),
  gender:    v.picklist(['male', 'female']),
  notes:     v.optional(v.pipe(v.string(), v.maxLength(1000))),
})

export type CreatePatientInput = v.InferOutput<typeof createPatientSchema>
```

Xato xabarlari — **tarjima kalitlari**, tayyor matn emas. 4 ta til bor.

```tsx
// features/patient-create/ui/CreatePatientForm.tsx
export function CreatePatientForm({ onSuccess }: Props) {
  const { t } = useTranslation('patients')
  const form = useForm<CreatePatientInput>({
    resolver: valibotResolver(createPatientSchema),
    mode: 'onBlur',                          // onChange emas — har harfda validatsiya bezovta qiladi
  })
  const { mutate, isPending } = useCreatePatient()

  const onSubmit = form.handleSubmit((values) =>
    mutate(values, {
      onSuccess,
      onError: (error) => {
        // Server validatsiyasini forma maydonlariga qaytarish
        if (error instanceof ApiError && error.kind === 'validation') {
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            form.setError(field as keyof CreatePatientInput, { message: messages[0] })
          }
        }
      },
    })
  )
  // ...
}
```

**Server xatolarini formaga qaytarish majburiy.** Aks holda foydalanuvchi "Nimadir xato" toast'ini ko'radi va qaysi maydon noto'g'riligini bilmaydi.

### 10.2. Yo'qotilgan ma'lumotdan himoya

Uzun formalarda (anamnez, tibbiy yozuv) foydalanuvchi tasodifan sahifadan chiqib ketmasin:

```tsx
useBlocker({
  condition: form.formState.isDirty && !isPending,
  blockerFn: () => window.confirm(t('common.unsavedChanges')),
})
```

> ⛔ Forma qoralamasini `localStorage`ga saqlash **taqiqlanadi** — bu PHI. Faqat xotirada.

---

## 11. Dizayn tizimi — "Apple-style"

### 11.1. Falsafa

Apple uslubi — bu "oq fon + yumaloq burchak" emas. Bu **cheklov intizomi**:
- Bitta aksent rang
- Uch daraja matn ierarxiyasi
- Soya emas, chegara
- Bo'sh joy — dizayn elementi, isrof emas

Minimalist yo'nalishda nafislik **aniqlikdan** keladi: spacing, tipografika va detal to'g'ri bo'lsa, dizayn "qimmat" ko'rinadi. Bitta noto'g'ri padding butun taassurotni buzadi.

### 11.2. Tokenlar

```css
/* app/styles/theme.css */
@import "tailwindcss";

@theme {
  /* ── Fon qatlamlari ── sof oq emas, ohangli */
  --color-canvas:    #f5f5f7;   /* sahifa foni */
  --color-surface:   #ffffff;   /* karta, modal */
  --color-elevated:  #ffffff;   /* popover, dropdown */
  --color-sunken:    #ebebef;   /* input foni, disabled */

  /* ── Chegaralar ── alpha orqali, qattiq kulrang emas */
  --color-border:        oklch(0% 0 0 / 0.08);
  --color-border-strong: oklch(0% 0 0 / 0.14);

  /* ── Matn — 3 daraja, ko'p emas ── */
  --color-text:           #1d1d1f;
  --color-text-secondary: #5f5f65;
  --color-text-tertiary:  #6e6e73;

  /* ── Aksent — BITTA ohang, IKKI rol ── */
  --color-accent:       #0071e3;   /* fon: oq matn bilan 4.70:1 */
  --color-accent-hover: #0062c8;
  --color-accent-text:  #0068d1;   /* matn/havola: canvas ustida 4.94:1 */
  --color-accent-soft:  #e8f2fe;
  --color-on-accent:    #ffffff;

  /* ── Semantik — faqat holat uchun ── */
  --color-success: #1f7a35;
  --color-warning: #8f5b00;
  --color-danger:  #d70015;

  /* ── Radius ── */
  --radius-control: 10px;   /* tugma, input */
  --radius-card:    18px;   /* karta, modal */
  --radius-sheet:   24px;   /* bottom sheet */

  /* ── Soya — juda yumshoq ── */
  --shadow-card:    0 1px 3px oklch(0% 0 0 / 0.04), 0 1px 2px oklch(0% 0 0 / 0.03);
  --shadow-popover: 0 8px 28px oklch(0% 0 0 / 0.10);

  /* ── Apple'ning imzo egri chizig'i ── */
  --ease-out-apple:  cubic-bezier(0.32, 0.72, 0, 1);
  --ease-in-out-app: cubic-bezier(0.4, 0, 0.2, 1);

  /* ── Tipografika ── */
  --font-sans: "Inter Variable", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

/* Inter'ni SF Pro'ga yaqinlashtirish */
html {
  font-family: var(--font-sans);
  font-feature-settings: "cv11", "ss01", "cv02";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

> 🔬 **Kontrast (2026-08-21 yangilandi).** Dastlabki palitra iOS ranglaridan olingan edi va
> `§11.7` ning o'z AA talabidan yiqilardi: `#86868b` oq ustida 3.9:1, `#34c759` — 4.0:1,
> `#0071e3` matn sifatida canvas ustida 4.31:1. Qiymatlar AA ga moslab quyultirildi.
>
> **Aksent ikki rolga ajratildi**, chunki bitta qiymat ikkalasini bajara olmaydi:
> `--color-accent` (#0071e3) — fon uchun, oq matn bilan 4.70:1. `--color-accent-text`
> (#0068d1) — matn va havola uchun. Ohang bir xil, shuning uchun interfeys hamon
> bitta aksent sifatida o'qiladi.
>
> `--color-text-tertiary` **`sunken` ustida ishlatilmaydi** — u yerda AA ga chiqmaydi.
> Input placeholder'i `--color-text-secondary` dan foydalanadi.
>
> Bularning hammasi `pnpm check:contrast` bilan **o'lchanadi** va CI'da majburlanadi.
> Token o'zgartirsangiz — skript qayta ishga tushadi, taxminga o'rin yo'q.

> ⚖️ **Huquqiy:** **SF Pro'ni veb'da ishlatmang.** Apple litsenziyasi uni faqat Apple platformalari uchun interfeys dizaynida ruxsat beradi; veb-saytga yuklash litsenziya buzilishi. `Inter Variable` yoki `Geist` — vizual jihatdan juda yaqin va bepul (OFL).

### 11.3. Spacing — 8pt grid

Faqat shu qiymatlar: `4, 8, 12, 16, 24, 32, 48, 64`. Oraliq qiymat (`13px`, `18px`) — code review'da rad etiladi.

### 11.4. Tipografik shkala

| Rol | O'lcham / balandlik | Og'irlik | Letter-spacing |
|---|---|---|---|
| Display | 40 / 44 | 600 | −0.02em |
| Title 1 | 28 / 34 | 600 | −0.015em |
| Title 2 | 22 / 28 | 600 | −0.01em |
| Body | 15 / 22 | 400 | 0 |
| Callout | 14 / 20 | 400 | 0 |
| Caption | 12 / 16 | 400 | +0.01em |

Manfiy letter-spacing katta o'lchamlarda — Apple tipografikasining eng seziladigan detali.

### 11.5. Animatsiya

```tsx
// Toggle switch — "premium" hissi aynan shu yerdan keladi
<motion.div
  layout
  transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
/>
```

**Qoidalar:**
- `transition: all 0.3s ease` — **taqiqlangan**. Arzon ko'rinadi.
- Fizik harakat (switch, sheet, drag) → `spring`.
- Rang/opacity o'zgarishi → `duration: 150ms, ease-out-apple`.
- Modal ochilishi → 220ms, scale `0.96 → 1` + opacity.
- Ro'yxat elementlari → `stagger: 0.02s`, undan ko'p emas.

```tsx
// Har bir animatsiya komponentida — MAJBURIY
const shouldReduceMotion = useReducedMotion()
```

Animatsiya funksionallikni **kutish vaqtini yashirish** uchun ishlatiladi, e'tibor tortish uchun emas. Tibbiy panelda ortiqcha harakat — charchoq manbai.

### 11.6. Interfeys matni (UI copy)

Matn — dizayn materiali. Unga spacing bilan bir xil e'tibor beriladi.

| Qoida | ❌ | ✅ |
|---|---|---|
| Aktiv fe'l, aniq natija | "Yuborish" | "Bemorni saqlash" |
| Amal nomi oxirigacha bir xil | tugma "Saqlash" → toast "Muvaffaqiyatli" | tugma "Saqlash" → toast "Saqlandi" |
| Xato — nima bo'ldi va nima qilish kerak | "Xatolik yuz berdi" | "Bu vaqt band. Boshqa vaqt tanlang." |
| Bo'sh ekran — harakatga taklif | "Ma'lumot yo'q" | "Hali bemor qo'shilmagan. Birinchi bemorni qo'shing." |
| Foydalanuvchi tilida, tizim tilida emas | "Sinxronizatsiya xatosi (code 4021)" | "O'zgarishlar saqlanmadi. Qayta urinib ko'ring." |

Xato xabari uzr so'ramaydi va noaniq bo'lmaydi.

### 11.7. Sifat poli (majburiy minimum)

Har bir komponent uchun, alohida eslatmasdan:
- Klaviatura bilan to'liq boshqariladi, `:focus-visible` ko'rinadi
- Mobil (360px) da buzilmaydi
- `prefers-reduced-motion` hurmat qilinadi
- Kontrast WCAG AA (4.5:1 matn, 3:1 UI element)
- Bosiladigan maydon ≥ 44×44px
- Loading/empty/error holatlari bor (`§15`)

---

## 12. Ko'p tillilik (i18n)

### 12.1. Sozlash

```
src/shared/i18n/locales/
  uz/  common.json  patients.json  appointments.json  validation.json
  ru/  ...
  en/  ...
  kaa/ ...        # yoki loyihaga kerakli 4-til
```

Namespace'lar modul bo'yicha bo'linadi va **lazy** yuklanadi — bemorlar modulida ishlayotgan xodim uchrashuvlar tarjimasini yuklamaydi.

### 12.2. ICU MessageFormat — rus tili uchun majburiy

```json
{
  "patientCount": "{count, plural, one {# пациент} few {# пациента} other {# пациентов}}"
}
```

Rus tilida uch xil ko'plik shakli bor (1 / 2–4 / 5–20). Oddiy `if (n > 1)` mantiq buziladi. `i18next-icu` plaginini yoqing.

### 12.3. Dinamik kontent — DB'da, JSON'da emas

Klinika o'z xizmatlarini o'zi kiritadi ("Implantatsiya", "Professional gigiyena"). Bu tarjimalar **Django DB**da (`django-modeltranslation`), frontend faylida emas.

**Qoida:**
- Statik interfeys matni → frontend JSON
- Foydalanuvchi kiritgan kontent → backend, `Accept-Language` header'iga qarab qaytariladi

### 12.4. Sana va vaqt — qat'iy qoidalar

```ts
// shared/lib/datetime.ts
import { TZDate } from '@date-fns/tz'

export const CLINIC_TZ = 'Asia/Tashkent'

export function formatAppointmentTime(utcIso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: CLINIC_TZ,
  }).format(new Date(utcIso))
}
```

| Qoida | Sabab |
|---|---|
| Backend har doim **UTC ISO-8601** qaytaradi | Yagona haqiqat |
| Konvertatsiya **faqat ko'rsatish paytida** | Biznes mantiq UTC'da ishlaydi |
| `Intl.DateTimeFormat` ishlatiladi, qo'lda formatlash yo'q | Har til o'z formatiga ega |
| Vaqt zonasi klinikanikidan olinadi, brauzernikidan emas | Xodim safarda bo'lishi mumkin |

Uchrashuv 1 soatga surilib ketishi tibbiy tizimda jiddiy hodisa. Bu qoidalarga chegirma yo'q.

### 12.5. O'zbek tili

Lotin va kirill — bu **ikkita alohida lokal** (`uz-Latn`, `uz-Cyrl`), avtomatik transliteratsiya emas. Ba'zi atamalar va imlo farq qiladi.

### 12.6. Tarjima jarayoni

Tarjimon Git bilmaydi. **Tolgee** yoki **Crowdin** ulang — tarjimalar veb-interfeysda tahrirlanadi va PR sifatida keladi.

**Yetishmayotgan kalitlar CI'da xato beradi:**
```bash
pnpm i18n:check   # barcha tillarda kalitlar to'liqligini tekshiradi
```

---

## 13. Xavfsizlik

Tibbiy ma'lumot bilan ishlaganda xavfsizlik — "keyinroq qo'shamiz" degan narsa emas. Quyidagilar **arxitekturaviy talab**.

### 13.1. Autentifikatsiya

```
Brauzer ──httpOnly cookie──▶ nginx ──▶ Django
   ▲                                      │
   └────── Set-Cookie (Secure, ...) ──────┘
```

Cookie parametrlari (Django tomonda o'rnatiladi):
```
HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=...
```

| Element | Qiymat |
|---|---|
| Access token muddati | 10–15 daqiqa |
| Refresh token muddati | 7 kun, **rotatsiya bilan** |
| Refresh rotatsiyasi | Har ishlatilishda yangisi beriladi, eskisi blacklist'ga |
| Qayta ishlatish aniqlansa | Butun oila (token family) bekor qilinadi — o'g'irlik belgisi |
| Logout | Server tomonda blacklist + `queryClient.clear()` |

> Bir xil origin bo'lgani uchun Django'ning o'z **session authentication**i ham to'liq yaroqli va soddaroq variant. Qaror `ADR-003`da.

### 13.2. 🔴 Token saqlash

```ts
localStorage.setItem('token', jwt)    // ⛔ HECH QACHON
sessionStorage.setItem('token', jwt)  // ⛔ HECH QACHON
document.cookie = 'token=...'         // ⛔ HECH QACHON (httpOnly emas)
```

`localStorage`dagi token **har qanday JavaScript'ga ochiq**. Bitta zaharlangan npm paketi (2026-yilda kundalik hodisa) — va 1000 klinikaning bemor bazasi ketdi.

Frontend kodi tokenni **umuman ko'rmaydi**. Bu shunchaki qoida emas — arxitektura shunday qurilgan.

### 13.3. CSRF

`SameSite=Strict` ko'p narsani hal qiladi, lekin yagona himoya emas:

```ts
if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
  request.headers.set('X-CSRFToken', getCookie('csrftoken'))
}
```

Django `CsrfViewMiddleware` yoqilgan holda qoladi.

### 13.4. 🔴 PHI gigiyenasi

PHI (Protected Health Information) — bemor ismi, telefoni, tug'ilgan sanasi, diagnozi, tasvirlari.

| Qoida | Sabab |
|---|---|
| ⛔ URL'da PHI yo'q | Server loglari, `Referer`, brauzer tarixi, ekran ulashish |
| ⛔ `console.log` da PHI yo'q | Production build'da ham qoladi |
| ⛔ `localStorage` / `sessionStorage` / `IndexedDB` da PHI yo'q | Umumiy kompyuter |
| ⛔ Analytics'ga PHI yuborilmaydi | Uchinchi tomon serveri |
| ⛔ Xato xabari matnida PHI yo'q | Sentry'ga tushadi |
| ✅ Sentry'da `beforeSend` scrubber | Quyida |
| ✅ Logout'da `queryClient.clear()` | Keyingi xodim ko'rmasin |
| ✅ Idle timeout | Registratura stoli ochiq qoladi |

```ts
// app/providers/sentry.ts
Sentry.init({
  dsn: env.SENTRY_DSN,
  sendDefaultPii: false,
  beforeSend(event) {
    // URL'lardan query stringni butunlay olib tashlash
    if (event.request?.url) event.request.url = stripQuery(event.request.url)
    delete event.request?.cookies
    delete event.request?.headers?.Authorization

    // Breadcrumb'lardan tanaviy ma'lumotni olib tashlash
    event.breadcrumbs = event.breadcrumbs?.map((b) => ({
      ...b,
      data: b.category === 'fetch' || b.category === 'xhr'
        ? { url: stripQuery(String(b.data?.url ?? '')), status_code: b.data?.status_code }
        : undefined,
    }))
    return event
  },
})
```

```ts
// shared/lib/useIdleTimer.ts
export const IDLE_TIMEOUT_MS = 90 * 60 * 1000   // 90 daqiqa (egasi qarori; avval 12)
export const IDLE_WARNING_MS = 60 * 1000        // 1 daqiqa oldin ogohlantirish
```

Vaqt tugaganda: ekran qulflanadi (ma'lumot yashiriladi), parol so'raladi, `queryClient.clear()` bajariladi.

### 13.5. Xavfsizlik header'lari (nginx)

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' wss://app.salomatos.uz; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

`Referrer-Policy: no-referrer` — bemor sahifasidagi URL tashqi saytga sizib chiqmasligi uchun.

> **CSP eslatmasi:** `style-src 'unsafe-inline'` Tailwind uchun kerak emas (u statik CSS chiqaradi), lekin Radix ba'zi inline style ishlatadi. Iloji bo'lsa nonce ishlating. `script-src`da `'unsafe-inline'` va `'unsafe-eval'` — **hech qachon**.

### 13.6. Env o'zgaruvchilari — SPA'da HAMMASI OCHIQ

> ⚠️ Vite'da `VITE_` prefiksli har bir o'zgaruvchi **bundle ichiga matn sifatida yoziladi** va istalgan foydalanuvchi ko'ra oladi.

```
VITE_API_URL=/api                    ✅
VITE_SENTRY_DSN=https://...          ✅ (DSN ommaviy bo'lishi normal)
VITE_STRIPE_SECRET_KEY=sk_live_...   ⛔ KATASTROFA
```

**Qoida:** hech qanday maxfiy kalit frontend'da bo'lmaydi. To'lov, SMS, email, tashqi API — hammasi Django orqali proxy qilinadi.

CI'da tekshiruv: `SECRET|PRIVATE|PASSWORD|TOKEN` naqshlari `dist/` ichida topilsa — build yiqiladi.

### 13.7. Media fayllar (rentgen, skanlar)

Tibbiy tasvirlar — eng sezgir ma'lumot.

- ⛔ Ochiq `/media/` URL yo'q. Fayl nomini bilgan har kim ochib olmasin.
- ✅ Django ruxsatni tekshiradi → `X-Accel-Redirect` orqali nginx faylni beradi
- ✅ Yoki qisqa muddatli (5 daq) imzolangan URL
- ⛔ `<img src>` URL'i keshda uzoq qolmasin: `Cache-Control: private, no-store`

### 13.8. Ta'minot zanjiri (supply chain)

| Chora | Vosita |
|---|---|
| Lockfile majburiy | `pnpm install --frozen-lockfile` CI'da |
| Zaifliklarni tekshirish | `pnpm audit --audit-level=high` CI'da |
| Avtomatik yangilanish | Renovate (security patch — avtomatik merge) |
| Yangi dependency | PR'da sabab yozilishi shart. Har bir paket — hujum yuzasi. |
| Postinstall skriptlar | `pnpm config set ignore-scripts true` + kerakli paketlarga aniq ruxsat |

### 13.9. 🇺🇿 O'zbekiston qonunchiligi

Bu texnik emas, **huquqiy talab** — lekin arxitekturaga bevosita ta'sir qiladi.

2021-yildan "Shaxsga doir ma'lumotlar to'g'risida"gi qonunning 27¹-moddasi lokalizatsiyani talab qilgan edi. **2026-yil 27-martdan kuchga kirgan o'zgartirishlar bu talabni yumshatdi:** endi mamlakat ichida majburiy saqlanadigan toifalar — **biometrik va genetik ma'lumotlar**, shuningdek telekom operatorlari abonentlarining ma'lumotlari. Qolgan toifalarni ma'lum shartlar asosida xorijda saqlash mumkin (masalan, xorijiy davlat yetarli himoya darajasiga ega deb tan olinsa, yoki vakolatli organ tasdiqlagan standart shartlar joriy etilsa).

**Sizga amaliy ta'siri:**

| Ma'lumot | Talab |
|---|---|
| Rentgen, 3D skan, tish qoliplari, bemor fotosurati | Biometrik deb talqin qilinishi ehtimoli **yuqori** → O'zbekiston ichidagi saqlash |
| Bemor ismi, telefoni, tashrif tarixi | Yumshatilgan rejim, lekin shartlar bajarilishi kerak |
| Frontend statik fayllari (`dist/`) | PHI yo'q → istalgan CDN'da bo'lishi mumkin |

**Frontend uchun xulosa:** `dist/` papkasi CDN'da bo'lishi mumkin, lekin **API va media** mahalliy infratuzilmada. Shuning uchun `§1.2` dagi same-origin sxemasi mahalliy serverda qoladi.

> ⚖️ Men huquqshunos emasman va qonun hozir faol o'zgarish bosqichida. 1000 klinika bilan shartnoma tuzishdan oldin **O'zbekistonlik yurist bilan maslahatlashing.** Bu texnik qaror emas, biznes riski.

---

## 14. Ishlash tezligi (Performance)

### 14.1. Budjet — CI'da majburlanadi

| Ko'rsatkich | Chegara |
|---|---|
| Boshlang'ich JS (gzip) | ≤ 180 KB |
| Route chunk (gzip) | ≤ 90 KB |
| CSS (gzip) | ≤ 40 KB |
| LCP (4G, o'rta darajali Android) | ≤ 2.0s |
| INP | ≤ 200ms |
| Jadval bilan interaksiya (1000 qator) | ≤ 100ms |

```bash
pnpm build:analyze   # rollup-plugin-visualizer
```

Budjetdan oshgan PR merge qilinmaydi. "Keyinroq optimallashtiramiz" — bu hech qachon sodir bo'lmaydi.

### 14.2. Asosiy usullar

| Usul | Qayerda |
|---|---|
| Route-based code splitting | Avtomatik (TanStack Router) |
| Virtualizatsiya | 100+ qatorli har qanday ro'yxat → TanStack Virtual |
| Debounce | Qidiruv inputlari → 300ms |
| Prefetch | Jadval qatoriga hover → `queryClient.prefetchQuery(detail)` |
| Og'ir kutubxonalar lazy | `recharts`, PDF viewer, rasm tahrirlagich → `React.lazy` |
| Rasm optimizatsiyasi | Backend WebP/AVIF variantlarini beradi + `loading="lazy"` |

### 14.3. Renderni nazorat qilish

- Zustand selector'lari tor bo'lsin
- `useMemo` faqat o'lchangan muammo uchun (profiler bilan tasdiqlangan)
- React Compiler (React 19) yoqilgan — qo'lda `memo` ehtiyoji kamayadi
- Katta jadvallarda `key` — barqaror ID, index emas

---

## 15. Xatolar, yuklanish va bo'sh holatlar

**Har bir ma'lumot ko'rsatadigan ekran 4 ta holatni qamrab olishi shart.** Bu Definition of Done'ning bir qismi.

| Holat | Yechim |
|---|---|
| **Loading** | Skeleton (spinner emas) — layout shift bo'lmasin |
| **Empty** | Harakatga taklif: "Hali bemor qo'shilmagan. Birinchi bemorni qo'shing." + tugma |
| **Error** | Nima bo'ldi + nima qilish kerak + "Qayta urinish" tugmasi |
| **Success** | Asosiy kontent |

```tsx
// shared/ui/QueryBoundary.tsx — standart namuna
<QueryBoundary
  query={patientsQuery}
  loading={<PatientTableSkeleton rows={10} />}
  empty={<EmptyPatients onCreate={openCreateDialog} />}
>
  {(patients) => <PatientTable data={patients} />}
</QueryBoundary>
```

**Error Boundary ierarxiyasi:**
1. **Root** — oq ekran o'rniga "Ilova ishga tushmadi" + qayta yuklash
2. **Route** — bitta sahifa yiqilsa, sidebar va navigatsiya ishlashda qoladi
3. **Widget** — jadval yiqilsa, sahifaning qolgani ko'rinadi

Tibbiy tizimda qisman ishlaydigan ilova — butunlay o'lgan ilovadan ancha yaxshi.

---

## 16. Testlash

### 16.1. Piramida

| Daraja | Vosita | Qamrov | Nima testlanadi |
|---|---|---|---|
| Unit | Vitest | Mantiq 100% | Formatlash, hisob-kitob, validatsiya schema'si, mapper |
| Komponent | Vitest + RTL + MSW | Asosiy oqimlar | Formalar, jadvallar, `Can` gate |
| E2E | Playwright | 8–12 kritik yo'l | Quyida |

### 16.2. E2E — majburiy stsenariylar

1. Login → dashboard → logout
2. Bemor yaratish → ro'yxatda ko'rinishi → tahrirlash
3. Uchrashuv belgilash → konflikt (band vaqt) → xato xabari
4. Uchrashuvni ko'chirish (optimistic + rollback)
5. Klinika almashtirish → **eski klinika ma'lumoti ko'rinmasligi** ← 🔴 xavfsizlik testi
6. Ruxsatsiz rol tugmani ko'rmasligi
7. Til almashtirish → tarjima qo'llanishi
8. Idle timeout → ekran qulflanishi
9. Tarmoq uzilishi → xato holati → qayta ulanish

### 16.3. MSW mocklari — Orval generatsiya qiladi

```ts
// orval.config.ts
override: {
  mock: { type: 'msw', useExamples: true }
}
```

Mocklar OpenAPI schema'dan chiqadi → **testlar hech qachon real API'dan chetga chiqmaydi**. Backend kontrakt o'zgarsa, testlar ham buziladi. Bu — xohlagan narsamiz.

> ⛔ Test fixture'larida haqiqiy bemor ma'lumoti ishlatilmaydi. Faqat sun'iy ma'lumot.

---

## 17. Git, CI/CD va kod sifati

### 17.1. Branch va commit

- Branch: `feat/patient-archive`, `fix/appointment-timezone`, `chore/deps-bump`
- Commit: [Conventional Commits](https://www.conventionalcommits.org/)
- `main` — himoyalangan. PR + 1 approve + yashil CI.

### 17.2. Pre-commit (Husky + lint-staged)

```
biome check --write
tsc --noEmit
vitest related --run
```

### 17.3. CI pipeline

```yaml
- pnpm install --frozen-lockfile
- pnpm biome ci .
- pnpm lint:boundaries    # qatlam grafigi (§3.3)
- pnpm tsc --noEmit
- pnpm api:check          # generated tiplar yangimi?
- pnpm i18n:check         # barcha tillarda kalit to'liqmi?
- pnpm test --coverage
- pnpm build
- pnpm size-limit         # performance budjeti
- pnpm audit --audit-level=high
- grep -rE "(SECRET|PRIVATE_KEY|PASSWORD)" dist/ && exit 1   # sir sizib ketmadimi?
- pnpm playwright test    # faqat main'ga PR'da
```

### 17.4. TypeScript sozlamalari

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,      // arr[0] → T | undefined
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true
  }
}
```

> ⛔ `any` — taqiqlangan. Noma'lum tip uchun `unknown` + narrowing.
> ⛔ `@ts-ignore` — taqiqlangan. Zarur bo'lsa `@ts-expect-error` + sabab kommentariyasi.
> ⛔ `!` (non-null assertion) — faqat isbotlangan holatlarda, komment bilan.

---

## 18. Arxitektura qarorlari (ADR)

> Format: **Kontekst → Qaror → Oqibat**. Yangi ADR faqat qo'shiladi, eskisi o'chirilmaydi (`Superseded` deb belgilanadi).

### ADR-001 — Vite SPA, Next.js emas
**Status:** Qabul qilingan (2026-07)

**Kontekst.** Tizimning 95% i login orqasidagi og'ir interaktiv panel. Deploy O'zbekistondagi mahalliy infratuzilmada bo'ladi. Jamoa kichik.

**Qaror.** Vite + React SPA.

**Sabablar.**
- Node runtime yo'q → deploy `dist/` nusxalash, xotira sarfi nol, server CVE yuzasi nol
- Next.js middleware'da muntazam auth-bypass CVE'lari chiqadi (2026-may — 13 ta advisory). Bu qatlam bizga kerak emas ekan, uni saqlash — behuda risk
- RSC/Server Components modeli Django backend bilan qo'shimcha qiymat bermaydi — ma'lumot baribir DRF'dan keladi
- Kichik jamoa uchun "server komponentmi yoki client?" savoli har kuni kognitiv soliq

**Oqibatlar.**
- ➖ SEO yo'q → `§1.3` dagi strategiya bilan qoplanadi
- ➖ BFF qatlami yo'q → same-origin nginx sxemasi bilan qoplanadi (`ADR-002`)
- ➖ Marketing sayti alohida loyiha bo'ladi
- ➕ Build sekundlarda, HMR bir zumda
- ➕ Deploy va monitoring keskin sodda

**Qachon qayta ko'riladi.** Agar ommaviy, Google'dan izlanadigan klinika kataloglari mahsulot talabiga aylansa.

---

### ADR-002 — Same-origin deployment (nginx)
**Status:** Qabul qilingan

**Kontekst.** ADR-001 bilan Next.js BFF qatlami yo'qoldi. `httpOnly` cookie autentifikatsiyasini saqlab qolish kerak.

**Qaror.** SPA va Django bitta domendan. nginx `/api/*` ni Django'ga, qolganini `dist/` ga yo'naltiradi.

**Oqibatlar.**
- ➕ CORS umuman yo'q
- ➕ Birinchi tomon cookie, `SameSite=Strict` mumkin
- ➕ BFF'siz ham token JS'ga tegmaydi
- ➖ Frontend va backend deploy'i koordinatsiya talab qiladi (blue-green bilan hal qilinadi)

---

### ADR-003 — Auth: httpOnly cookie
**Status:** Qabul qilingan

**Kontekst.** Uch variant: (a) `localStorage`da JWT, (b) `httpOnly` cookie'da JWT, (c) Django session.

**Qaror.** Token `httpOnly` cookie'da. Boshlanish uchun **Django session authentication** — u eng sodda va Django tomonidan to'liq boshqariladi (bekor qilish, rotatsiya, muddat). Mobil ilova paydo bo'lganda unga alohida JWT endpoint ochiladi.

**Rad etilgan: `localStorage`da JWT.** XSS orqali 1000 klinikaning bemor bazasi o'g'irlanadi. Tibbiy ma'lumot uchun qabul qilib bo'lmaydi. Qulaylik farqi (CSRF token qo'shish) — bu risk oldida arzimas.

**Oqibatlar.**
- ➕ Frontend kodi tokenni umuman ko'rmaydi
- ➖ CSRF himoyasi kerak → `§13.3`
- ➖ Bir nechta backend domeni bo'lsa murakkablashadi → hozircha yo'q

**Aniqlashtirish (2026-08-21).** Qaror qayta tasdiqlandi: **Django session authentication**.
`§13.1` dagi access/refresh muddati va rotatsiya jadvali — kelajakdagi **mobil JWT endpoint**iga tegishli,
veb SPA'ga emas. Amaliy oqibati: `httpClient` da (`§5.2`) refresh oqimi **yo'q** —
401 kelganda `refreshSession()` chaqirilmaydi, to'g'ridan-to'g'ri `hardLogout()` bajariladi va
`/login` ga yo'naltiriladi. Sessiya muddatini Django uzaytiradi, frontend emas.

**Qayta ko'rib chiqildi (2026-08-25) — `Bearer` token, xotirada.**
> ⚠️ Bu qaror **hujjat tanlovi bilan emas, mavjud backend bilan** almashtirildi. Backend
> tahlili ko'rsatdiki, Django `simplejwt` ni ishlatadi: `DEFAULT_AUTHENTICATION_CLASSES` —
> `CustomJwtAuthentication`, `POST /api/login/` esa tokenlarni **javob tanasida** qaytaradi
> (`{message, result: {access_token, refresh_token}}`). `httpOnly` cookie yo'q, sessiya
> autentifikatsiyasi API uchun ishlatilmaydi.

**Yangi qaror.** `Authorization: Bearer <access_token>`, token **faqat RAM'da**
(`shared/api/tokenStore.ts`).

**P0 saqlanadi.** ADR-007 va `§13.2` o'z kuchida: token brauzer xotirasiga **yozilmaydi**.
Bu yerda tanlov yo'q edi — `localStorage` variantini foydalanuvchi so'rasa ham bajarilmaydi.

**Narxi, ochiq aytilgan.** Sahifa yangilanishi = tizimdan chiqish. Token xotirada, backend esa
cookie o'rnatmaydi, ya'ni tiklanadigan manba yo'q. Umumiy registratura kompyuterida bu
xatti-harakat **to'g'ri**, lekin xodimlar uni nuqson deb hisoblaydi. Yagona to'g'ri yechim —
backend tokenni `httpOnly` cookie'da bersa; bu backend o'zgarishi va ataylab qilinmadi.

**Refresh oqimi baribir yo'q.** Sabab endi boshqa: backend'da refresh route'i **umuman
mavjud emas** (`login/`, `me/`, `update/<pk>/` — boshqa hech narsa), shuning uchun
`refresh_token` yuboriladigan joy yo'q va u o'qilmaydi ham. 401 — terminal holat.

**Chiqish ham lokal.** Logout endpoint'i yo'q, va token bekor qilinmaydi:
`BLACKLIST_AFTER_ROTATION: True` yozilgan, lekin `token_blacklist` `INSTALLED_APPS` da
yo'q — `simplejwt` bu chaqiruvni jimgina yutadi. Ya'ni `useLogout` **ekranni** himoya qiladi,
**hisob ma'lumotini** emas. Berilgan token muddati tugaguncha (sukut bo'yicha **1 kun**)
amal qiladi. Buni yopish server tomonda.

**`X-Clinic-Id` header'i olib tashlandi** (`§5.2` dan chetlanish). Backend uni hech qayerda
o'qimaydi — tenant `request.user` dan olinadi. Header'ni qoldirish "u nimadir himoya
qilyapti" degan noto'g'ri taassurot berardi. Tenant izolyatsiyasi query key'larda qoladi
(`§6.2`), va bu P0 talabining haqiqiy mazmuni.

**Qayta ko'rib chiqildi (2026-09-30) — token endi Web Storage'da.** Yuqoridagi
"P0 saqlanadi" bandi endi kuchda emas: `ADR-014` xodimlarning har F5'da tizimdan
chiqib ketishini haqiqiy narx sifatida ko'rib, uni almashtirdi. To'liq qaror,
sabab va qabul qilingan xavf — `ADR-014`da.

---

### ADR-004 — TanStack Query, Redux emas
**Status:** Qabul qilingan

**Kontekst.** State'ning 85% i — server ma'lumoti.

**Qaror.** Server state → TanStack Query. Global client state → Zustand.

**Sabab.** Redux'da server ma'lumotini boshqarish `loading/error/data` boilerplate'ini qo'lda yozishni anglatadi. Kesh invalidatsiyasi, deduplikatsiya, optimistic update, background refetch — hammasi qo'lda. TanStack Query bularni tayyor beradi va `staleTime` orqali 1000 klinikada backend yukini boshqarish imkonini beradi.

---

### ADR-005 — Tailwind + shadcn/ui, komponent kutubxonasi emas
**Status:** Qabul qilingan

**Kontekst.** "Apple-style" — o'ziga xos dizayn tili talab qiladi.

**Qaror.** Tailwind v4 (`@theme` tokenlari) + shadcn/ui komponentlarini repozitoriyga nusxalash.

**Rad etilgan: MUI / Ant Design.** Ular o'z dizayn tilini olib keladi. Material'ni Apple'ga o'xshatish har bir komponentni override qilishni anglatadi — bu eng qimmat yo'l va natija baribir "yamoq" ko'rinadi.

**Oqibat.** shadcn komponentlari — **bizning kodimiz**, dependency emas. `pnpm update` dizaynni buzmaydi. Evaziga: xatolarni o'zimiz tuzatamiz.

---

### ADR-006 — Tiplar OpenAPI'dan generatsiya qilinadi
**Status:** Qabul qilingan

**Kontekst.** 4 rol × 4 til × o'nlab modul. Qo'lda yozilgan tiplar backend bilan sinxrondan chiqadi.

**Qaror.** `drf-spectacular` → OpenAPI → Orval. `api:check` CI qadamlaridan biri.

**Oqibat.** Backend kontrakti o'zgarsa — **build yiqiladi**, production emas. Evaziga: backend jamoasi schema sifatiga mas'ul bo'ladi (`§5.4`).

**Qayta ko'rib chiqildi (2026-08-25) — generatsiya yo'q, qo'lda yozilgan sxemalar.**
> Backend `drf-yasg` ni ishlatadi (`drf-spectacular` emas). U **Swagger 2.0** chiqaradi,
> Orval esa OpenAPI 3 kutadi. Bundan ham muhimi: schema route'i `config/urls.py` da
> **`if settings.DEBUG:`** ichida ro'yxatdan o'tadi, ya'ni to'g'ri sozlangan production'da
> u umuman mavjud bo'lmaydi. Generatsiyani CI qadami sifatida bog'lab bo'lmaydi.

**Yangi qaror.** Tiplar **qo'lda**, Valibot sxemalari sifatida (`ADR-011`), va ular
kompilyatsiya vaqtidagi tip emas — **ishga tushirish paytidagi tekshiruv**. `parse` qoladi.

**Nega bu yomonroq emas, balki boshqacha.** Generatsiya qilingan tiplar faqat kompilyatsiya
vaqtida ishlaydi: serializer jimgina maydonni tashlab ketsa, TypeScript buni bilmaydi va
xato production'da chiqadi. `v.parse` esa aynan o'sha holatni ushlaydi. Yo'qotilgani —
avtomatik sinxronizatsiya; qo'lga olingani — haqiqiy javob ustidan nazorat.

**Nima o'zgarganda qaytariladi.** Backend `drf-spectacular` ga o'tsa **va** `/api/schema/`
ni `DEBUG` dan chiqarsa: `orval.config.ts` qo'shiladi, sxemalardagi maydon tiplari
generatsiya qilinganlariga almashtiriladi, `parse` **qoladi**.

**`pnpm api:generate` va `api:check`** hozircha ishlamaydi. CI'dagi `api:check` qadami
`hashFiles('orval.config.ts') != ''` sharti ostida, ya'ni o'zini avtomatik o'chirib turadi.

---

### ADR-007 — Query kesh persist qilinmaydi
**Status:** Qabul qilingan

**Kontekst.** `persistQueryClient` offline qo'llab-quvvatlash beradi.

**Qaror.** Persist qilinmaydi. Kesh faqat RAM'da.

**Sabab.** Registratura kompyuteri umumiy. `localStorage`/`IndexedDB`dagi bemor bazasi — logout'dan keyin ham qoladi va istalgan xodim (yoki brauzer kengaytmasi) o'qiy oladi.

**Oqibat.** Offline rejim yo'q. Bu ongli almashuv: klinikada barqaror internet bor deb faraz qilinadi.

---

### ADR-008 — Tillar: uz-Latn, uz-Cyrl, ru, en
**Status:** Qabul qilingan (2026-08-21)

**Kontekst.** `§12` 4 tilni talab qiladi, lekin 4-si ochiq qolgan edi (`uz-Cyrl` yoki `kaa`).

**Qaror.** `uz-Latn`, `uz-Cyrl`, `ru`, `en`.

**Sabab.** `uz-Cyrl` — mavjud auditoriya uchun real ehtiyoj (katta yoshli xodimlar, ayrim hududlar),
va tarjima narxi eng past, chunki manba matn allaqachon o'zbekcha. `kaa` (qoraqalpoq) rad etilmadi,
faqat kechiktirildi — o'sha bozorga chiqish qarori qabul qilinganda 5-lokal sifatida qo'shiladi.

**Oqibatlar.**
- ⚠️ `uz-Latn` va `uz-Cyrl` — **ikkita alohida lokal** (`§12.5`). Avtomatik transliteratsiya
  ishlatilmaydi: imlo va ayrim atamalar farq qiladi.
- `pnpm i18n:check` to'rttala lokalda kalit to'liqligini talab qiladi.
- Ikkita o'zbek lokali tarjimonning ishini deyarli ikki barobar qilmaydi, lekin ularni
  sinxron ushlash uchun Tolgee/Crowdin (`§12.6`) foydasi oshadi.

---

### ADR-009 — Real-time: polling bilan boshlash, Channels keyin
**Status:** Qabul qilingan (2026-08-21)

**Kontekst.** `§6.6` WebSocket (Django Channels) invalidatsiya signallarini tavsiya qiladi.
Bu backend'da Channels + Redis infratuzilmasini talab qiladi va frontend Faza 2 ni bloklaydi.

**Qaror.** `cachePolicy.live` (30s `refetchInterval` + `refetchOnWindowFocus`) bilan boshlanadi.
Channels keyinroq, yuk yoki konflikt statistikasi buni oqlaganda qo'shiladi.

**Sabab.** `§6.6` ning o'zi aytadi: chaqiruv joyi ikkalasida bir xil
(`queryClient.invalidateQueries`), shuning uchun migratsiya og'riqsiz. Infratuzilmani
o'lchanmagan ehtiyoj uchun oldindan qurish — erta optimizatsiya.

**Oqibatlar.**
- ➕ Backend'da qo'shimcha ish yo'q, Faza 2 bloklanmaydi
- ➖ Eng yomon holatda 30 soniyalik kechikish. Registratura uchun qabul qilinadi;
  ikki bemorni bir vaqtga yozish xavfi backend'dagi 409 conflict bilan qoplanadi (`§6.5`)
- ➖ 1000 klinikada polling backend yukini oshiradi → `live` siyosati **faqat** bugungi
  jadval va navbat holatiga qo'llaniladi, boshqa hech qayerga emas

**Qachon qayta ko'riladi.** Polling yuki Django uchun sezilarli bo'lganda yoki
konflikt xatolari foydalanuvchilarni bezovta qila boshlaganda.

---

### ADR-010 — Klinika vaqt zonasi: konstanta
**Status:** Qabul qilingan (2026-08-21)

**Kontekst.** `§12.4` vaqt zonasi klinikanikidan olinishini talab qiladi, lekin u qayerda
saqlanishi ochiq edi: konstantami yoki har klinika sozlamasidami.

**Qaror.** `CLINIC_TZ = 'Asia/Tashkent'` — `shared/lib/datetime.ts` dagi konstanta.

**Sabab.** O'zbekiston butunlay bitta vaqt zonasida (UTC+5) va yozgi vaqtga o'tish yo'q.
Har bir formatlash chaqiruviga klinika kontekstini uzatish — hozir hech narsa bermaydigan murakkablik.

**Oqibatlar.**
- ➕ `formatAppointmentTime(utcIso, locale)` imzosi sodda qoladi
- ➖ Xorijga chiqilsa refaktoring kerak. Narxi past, chunki konvertatsiya
  **faqat bitta modulda** (`shared/lib/datetime.ts`) jamlangan — qoida shuning uchun ham bor
- ⚠️ Brauzer vaqt zonasi **hech qachon** ishlatilmaydi, hatto konstanta bo'lsa ham

---

### ADR-011 — Validatsiya: Valibot, Zod emas
**Status:** Qabul qilingan (2026-08-22)

**Kontekst.** `§2.1` `zod ^4` ni belgilaydi. Faza 5 oxirida bundle o'lchandi:
initial JS **174.3 kB / 180 kB** — bironta biznes moduli yozilmasdan turib atigi
**5.7 kB zaxira**. Vendor tarkibi (gzip, o'lchangan): React 69 · TanStack 37 ·
**Zod 29** · i18next 16 · ilova kodi 36.

Zod initial yo'lda, chunki uni ikkita eager modul ishlatadi: sessiya javobini
tekshirish (`sessionSchema`) va `login.tsx` dagi `validateSearch` — TanStack
Router `autoCodeSplitting` da faqat komponentni ajratadi, `beforeLoad` va
`validateSearch` esa route daraxti bilan birga yuklanadi.

**Qaror.** Zod o'rniga **Valibot**. API bir xil (schema + parse + tip chiqarish),
`@hookform/resolvers` ikkalasini ham qo'llab-quvvatlaydi, Standard Schema orqali
TanStack Router bilan ham ishlaydi.

**Natija — o'lchangan, taxmin emas.**

| | Initial JS (gzip) |
|---|---|
| Zod bilan | 174.3 kB |
| Valibot bilan | **160.1 kB** |
| Farq | **−14.2 kB** |

> ⚠️ Dastlab **−27 kB** deb baholangan edi. U raqam Zod alohida vendor chunk
> bo'lgan o'lchovdan olingan, u yerda har fayl o'z gzip lug'ati bilan siqiladi.
> Bitta chunk ichida Zod'ning marjinal narxi ikki barobar kam chiqdi. Bashorat
> emas, o'lchov yozilyapti.

**Oqibatlar.**
- ➕ Zaxira 5.7 → **19.9 kB**, ya'ni Faza 6–7 uchun haqiqiy joy
- ➖ Zod ekotizimi kengroq va ko'proq tanish; Valibot API'si funksional
  (`v.pipe(v.string(), v.minLength(1))`), zanjirli emas
- ➖ Generatsiya qilingan tiplar (Orval) Zod schema chiqarishi mumkin edi —
  Faza 2.1 da tekshiriladi; kerak bo'lsa faqat `sessionSchema` qaytariladi
- ⚖️ `§2.1` jadvali yangilandi

**Qachon qayta ko'riladi.** Agar Orval Valibot chiqara olmasa va qo'lda ko'prik
yozish narxi 14 kB dan qimmatga tushsa.

---

### ADR-012 — Ruxsatlar roldan olinadi (frontend'da)
**Status:** Qabul qilingan (2026-08-25) · **`§9.2` dan ongli chetlanish**

**Kontekst.** `§9.2` frontend'da rol→ruxsat xaritasini **taqiqlaydi**, va sabab to'g'ri:
agar ruxsatlar serverda bo'lsa, ularni roldan chiqaradigan frontend ertami-kechmi server
bilan kelishmay qoladi va foydalanuvchiga nima mumkinligi haqida **yolg'on gapiradi**.

**Muammo.** Bu backend'da kelishmaydigan narsaning o'zi yo'q. `/api/me/` faqat `role`
satrini qaytaradi. Ruxsat modeli yo'q, `ViewSet`larda per-view avtorizatsiya yo'q,
`DEFAULT_PERMISSION_CLASSES` — yolg'iz `IsAuthenticated`. Server admin bilan doktorni
**umuman ajratmaydi**.

**Qaror.** `entities/session/model/permissions.ts` da rol→ruxsat jadvali. `Can` va `useCan`
interfeysi o'zgarmaydi.

**⚠️ Buni to'g'ri tushunish muhim.** `§9.1` "frontend hech narsani himoya qilmaydi" deydi;
bu yerda holat bir daraja yomonroq: jadval **serverdagi qoidalarning aksi ham emas**, chunki
server qoidalari yo'q. U interfeysni tartibga soladi — doktorga billing tugmalari
ko'rsatilmaydi — va shundan nariga o'tmaydi. DevTools bilan besh soniyada aylanib o'tiladi
va server so'ralganini beradi. Buni yopish backend ishi.

**Nega baribir yoziladi.** Ikki sabab. Birinchisi — UI izchilligi: 10 ta modul `Can` ni
ishlatishga mo'ljallangan va uni olib tashlash har bir modulda alohida shartlar yozishga
olib keladi. Ikkinchisi — bu **o'rnini bosuvchi shakl**: `/api/me/` `permissions[]` massivini
chiqara boshlaganda **faqat shu fayl** o'chiriladi, chaqiruv joylari tegilmaydi.

**Oqibat.** `sessionSchema` da `role` yopiq `picklist` — noma'lum rol **rad etiladi**.
Bu ataylab: `Roles` modeldagi `TextChoices`, uni o'zgartirish migratsiya talab qiladi, ya'ni
kutilmaganda paydo bo'lmaydi. Jimgina bo'sh ruxsat to'plami berish esa foydalanuvchiga
butunlay bo'sh ilova ko'rsatardi.

---

### ADR-013 — ID'lar butun son, UUID emas
**Status:** Majburan qabul qilingan (2026-08-25) · **`§5.4` dan chetlanish**

**Kontekst.** `§5.4` barcha ID'lar UUID bo'lishini talab qiladi, sababi `§13`: ketma-ket
butun son enumeratsiyaga ochiq — `/patients/1`, `/patients/2`, va hokazo.

**Haqiqat.** Backend'da bironta UUID yo'q. Barcha modellar Django'ning standart
`AutoField` ini ishlatadi, barcha route'lar `<int:pk>` shaklida.

**Qaror.** Frontend butun sonni qabul qiladi. `sessionSchema` dagi UUID regex olib
tashlandi, `Session.userId` va `clinicId` — `number`.

**Bu xavfni yopmaydi, faqat qayd etadi.** Enumeratsiya xavfi joyida qoladi va u
frontend'da hal qilinmaydi. Backend tahlilida (§A3) ko'rsatilgan IDOR zaifliklari bilan
birga u ancha jiddiy: `get_user(user_id)`, `get_appointment(appointment_id)` va shu
naqshdagi metodlar tenant tekshiruvisiz ishlaydi, ketma-ket ID esa ularni tizimli
ravishda aylanib chiqishni oson qiladi.

**Nima qilinishi kerak (backend).** Avval har bir `get_<obyekt>(id)` ga tenant filtri —
bu ID turidan qat'i nazar majburiy. UUID migratsiyasi ikkinchi darajali va kattaroq ish.

**Qachon qayta ko'riladi.** Backend UUID'ga o'tsa: sxemalarda tip almashtiriladi va
`§5.4` tiklanadi. Frontend tomonda bu bir necha qatorlik o'zgarish.

---

### ADR-014 — Sessiya: access/refresh token Web Storage'da (`auth-session-storage`)
**Status:** Qabul qilingan (2026-09-30) · ADR-003ni almashtiradi

**Kontekst.** ADR-003 tokenni faqat RAM'da saqlashga majbur qildi — backend `httpOnly`
cookie bermaydi, session authentication ham ishlatilmaydi. Narxi ochiq aytilgan edi:
sahifa yangilanishi = tizimdan chiqish. Amalda bu xodimlar uchun nuqson sifatida
sezildi: F5 bosilganda ish yo'qoladi, forma qaytadan to'ldiriladi.

**Qaror.** `access_token` va `refresh_token` allowlist qilingan Web Storage orqali
saqlanadi (`shared/lib/storage.ts`, faqat shu ikki kalit + `locale`). Ilova
yuklanganda, router yaratilishidan **oldin**, `restoreSession()`
(`shared/api/authSession.ts`) tokenni RAM'ga tiklaydi — agar mavjud bo'lsa va JWT
`exp` hali o'tmagan bo'lsa; aks holda ikkala token o'chiriladi.

**Qabul qilingan xavf.** XSS endi joriy sessiyadan tashqari, keyingi reload'gacha
saqlangan tokenni ham o'qiy oladi — bu ADR-003/ADR-007 aynan shundan ogohlantirgan
xavf. Endi qabul qilinadi, chunki:
- Asosiy himoya XSS'ning o'ziga qaratilgan: `dangerouslySetInnerHTML` yo'q,
  dependency'lar nazorat qilinadi, CSP kelajakda qo'shiladi — token qayerda
  saqlanishidan qat'i nazar kerak bo'ladigan himoya.
- Token storage'da **eng qisqa vaqt** turadi: muddati o'tgani ishlatilmaydi
  (`restoreSession`), `401`da darhol o'chiriladi (`AppProviders.onUnauthorized`),
  logout va klinika almashtirishda tozalanadi.
- Bemor ma'lumoti (PHI) bu qarorga kirmaydi — query kesh hamon faqat RAM'da,
  `persistQueryClient` ishlatilmaydi (`ADR-007` o'zgarmadi).

**Oqibatlar.**
- ➕ F5 endi sessiyani yo'qotmaydi; login sahifasi miltillab ham ko'rinmaydi.
- ➕ Umumiy registratura kompyuterida xavf cheklangan: faqat qisqa umrli token,
  bemor bazasi emas.
- ➖ XSS'ning ta'sir doirasi kengaydi (yuqoridagi "qabul qilingan xavf"ga qarang).
- ➖ `refresh_token` saqlanadi, lekin backend'da uni almashtiradigan endpoint hozircha
  yo'q — bu faqat kelajak uchun tayyorgarlik, hech narsa uni ishlatmaydi.

**Qachon qayta ko'riladi.** Backend token refresh endpoint yoki `httpOnly` cookie
qo'shsa: token storage'dan butunlay olib tashlanadi, ADR-003ning asl (RAM'da yoki
cookie'da) yo'nalishiga qaytiladi.

---

## 19. Definition of Done

PR merge bo'lishidan oldin:

**Funksionallik**
- [ ] Loading / empty / error / success — 4 holat ham bor
- [ ] Server xatolari forma maydonlariga qaytariladi
- [ ] Optimistic update bo'lsa — rollback testlangan

**Tiplar va sifat**
- [ ] `any` yo'q, `@ts-ignore` yo'q
- [ ] Yangi API chaqiruvlari generated tiplardan foydalanadi
- [ ] Import qoidalari buzilmagan (`boundaries` yashil)

**i18n**
- [ ] Kodda hardcode matn yo'q
- [ ] 4 ta tilda ham kalitlar qo'shilgan
- [ ] Ko'plik shakllari ICU orqali

**Dizayn**
- [ ] Faqat `@theme` tokenlari ishlatilgan (hardcode `#hex` yo'q)
- [ ] 8pt grid buzilmagan
- [ ] Klaviatura navigatsiyasi, `:focus-visible` ko'rinadi
- [ ] 360px kenglikda buzilmaydi
- [ ] `prefers-reduced-motion` hurmat qilingan

**Xavfsizlik**
- [ ] `clinicId` query key ichida
- [ ] URL'da PHI yo'q
- [ ] `console.log` yo'q
- [ ] Yangi ruxsat kerak bo'lsa — backend'da ham qo'shilgan
- [ ] Yangi dependency bo'lsa — PR'da sabab yozilgan

**Testlar**
- [ ] Mantiq uchun unit test
- [ ] Kritik oqim bo'lsa — E2E
- [ ] Bundle budjeti oshmagan

---

## 20. Anti-patternlar (bularni qilmang)

| ❌ | ✅ |
|---|---|
| `useEffect` ichida `fetch` | `useQuery` / route `loader` |
| Query key'ni inline yozish | `patientKeys` factory |
| `clinicId`siz query key | Har doim tenant-scoped |
| Server ma'lumotini Zustand'ga ko'chirish | Query'da qoldirish |
| `useState` da jadval filtrlari | URL search params |
| `localStorage` da token yoki PHI | `httpOnly` cookie / faqat xotira |
| Hardcode rang: `bg-[#0071e3]` | `bg-accent` (token) |
| `transition: all 0.3s ease` | `spring` yoki aniq property + `--ease-out-apple` |
| Kodda `"Bemor qo'shish"` | `t('patients.create')` |
| Frontend'da rol → ruxsat xaritasi | `/api/me/` dan permission ro'yxati |
| Frontend tekshiruviga ishonish | Backend har doim qayta tekshiradi |
| Har bir sahifada auth guard | `_auth` layout'da bitta joyda |
| `any` bilan tiplarni "tuzatish" | `unknown` + narrowing |
| Mutation'ni `retry` qilish | `retry: false` |
| 1000 qatorli ro'yxatni to'g'ridan-to'g'ri render qilish | TanStack Virtual |

---

## 21. Qurilish tartibi (yangi loyiha uchun)

Ushbu ketma-ketlikni buzmang — har qadam oldingisiga tayanadi:

1. **Backend schema.** `drf-spectacular` ishlaydi, `/api/schema/` to'g'ri javob beradi.
2. **Skelet.** Vite + TS strict + Biome + papka strukturasi + `boundaries` linter.
3. **Tiplar.** Orval sozlanadi, `pnpm api:generate` ishlaydi.
4. **Dizayn tizimi.** `theme.css` tokenlari + `shared/ui/` (Button, Input, Switch, Select, Dialog, Table, Skeleton, Toast). **Bironta biznes modulini yozmasdan turib.**
5. **Auth + sessiya.** Login, `/api/me/`, route guard, idle timer, logout.
6. **i18n karkasi.** 4 til, namespace'lar, `i18n:check`.
7. **Birinchi vertikal qatlam.** Bemorlar moduli boshidan oxirigacha: entity → feature → widget → page. Bu **etalon** bo'ladi.
8. **Qolgan modullar.** Har biri 7-qadamdagi namunani takrorlaydi.

> 🔴 **4-qadamni o'tkazib yubormang.** Agar dizayn tizimi modullardan keyin qurilsa, har bir modulda tugmalar boshqacha ko'rinadi va "Apple-style" hech qachon chiqmaydi. Bu qaytarib bo'lmaydigan xato — keyin refaktoring narxi butun UI'ni qayta yozishga teng.

---

## 22. AI yordamchisi uchun ko'rsatma

Bu bo'lim `.cursorrules` / `CLAUDE.md` ga ham nusxalanadi.

```
Sen SalomatOS frontend loyihasida ishlayapsan — stomatologiya klinikalari uchun
ko'p ijarachili tibbiy SaaS.

MAJBURIY:
- Kod yozishdan oldin ARCHITECTURE.md dagi tegishli bo'limni o'qi.
- Qatlam qoidalarini buzma: app → pages → widgets → features → entities → shared.
- Har bir query key ichida clinicId bo'lsin.
- Hech qachon localStorage/sessionStorage'ga token yoki bemor ma'lumotini yozma.
- Hech qachon URL'ga bemor ismi/telefonini qo'yma.
- Rang, spacing, radius — faqat @theme tokenlaridan. Hardcode #hex yo'q.
- Foydalanuvchiga ko'rinadigan matn — faqat t() orqali.
- `any` va `@ts-ignore` ishlatma.
- API tiplarini qo'lda yozma — src/shared/api/generated dan import qil.
- Har bir ma'lumot ekranida loading/empty/error holatlarini ham yoz.

QILMA:
- Yangi dependency qo'shishdan oldin so'ra.
- Arxitektura qarorini o'zgartirishdan oldin so'ra (ADR yozilishi kerak).
- "Vaqtinchalik yechim" yozma — u vaqtinchalik bo'lmaydi.

SHUBHA BO'LSA:
Taxmin qilma — so'ra. Noto'g'ri arxitektura bilan yozilgan 500 qator kod
yozilmagan koddan yomonroq.
```

---

## Ilova A — Boshlash buyruqlari

```bash
pnpm create vite@latest salomatos-web -- --template react-ts
cd salomatos-web

# Yadro
pnpm add @tanstack/react-router @tanstack/react-query zustand valibot \
         react-hook-form @hookform/resolvers ky nuqs \
         date-fns @date-fns/tz

# UI
pnpm add tailwindcss @tailwindcss/vite motion lucide-react sonner cmdk \
         @tanstack/react-table @tanstack/react-virtual

# i18n
pnpm add i18next react-i18next i18next-resources-to-backend

# Dev
pnpm add -D @biomejs/biome vitest @testing-library/react @testing-library/user-event \
            jsdom msw @playwright/test orval \
            @tanstack/router-plugin @tanstack/react-query-devtools \
            eslint-plugin-boundaries rollup-plugin-visualizer size-limit

pnpm dlx shadcn@latest init
```

## Ilova B — Foydali havolalar

| Mavzu | Havola |
|---|---|
| TanStack Query | https://tanstack.com/query/latest |
| TanStack Router | https://tanstack.com/router/latest |
| Tailwind v4 `@theme` | https://tailwindcss.com/docs/theme |
| shadcn/ui | https://ui.shadcn.com |
| Orval | https://orval.dev |
| drf-spectacular | https://drf-spectacular.readthedocs.io |
| Feature-Sliced Design | https://feature-sliced.design |
| Radix UI | https://www.radix-ui.com |
