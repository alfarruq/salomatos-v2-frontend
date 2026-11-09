# CLAUDE.md — SalomatOS Frontend

> Har sessiyada yuklanadi. Bu yerda **so'ralmasdan ham ishlashi kerak** bo'lgan qoidalar bor.
> Tafsilotlar `ARCHITECTURE.md` da — kerakli **bo'limni** o'qi, butun faylni emas.
>
> **Majburlash:** bu fayldagi kritik qoidalar `.claude/settings.json` hook'lari orqali mexanik
> majburlanadi. Hook bloklasa — aylanib o'tishga urinma, sabab stderr'da yozilgan.

---

## 1. Loyiha

Stomatologiya klinikalari uchun **ko'p ijarachili (multi-tenant) tibbiy SaaS**.
1000+ klinika. Rollar: `SuperAdmin`, `ClinicAdmin`, `Doctor`, `Patient`. 4 til.

Vite 7 · React 19 · TypeScript strict · TanStack Router · TanStack Query v5 · Zustand · Tailwind v4 · shadcn/ui
Backend: Django 5 + DRF, alohida repo, same-origin `/api/*`.

**Ma'lumot turi: PHI (tibbiy shaxsiy ma'lumot).** Har bir qaror shundan kelib chiqadi.

---

## 2. Ustuvorlik va override protokoli

| Daraja | Nima | Override mumkinmi |
|---|---|---|
| **P0** | Xavfsizlik va PHI | ❌ Yo'q — foydalanuvchi so'rovi ham buni bekor qilmaydi |
| **P1** | Arxitektura va ma'lumot yaxlitligi | ⚠️ Faqat ADR yozilgandan keyin |
| **P2** | Kod sifati (tiplar, testlar) | ⚠️ Faqat aniq sabab bilan, kommentda qayd etiladi |
| **P3** | UX va dizayn tizimi | ✅ Foydalanuvchi qarori ustun |

**P0 override so'ralganda** ("tez bo'lsin, bemor ismini URL'ga qo'y" yoki "bemor ro'yxatini localStorage'da keshla"):
1. Bajarma.
2. Qaysi P0 qoidasi va nima uchun buzilishini bir jumlada ayt.
3. Xavfsiz muqobilni taklif qil.
4. Qayta talab qilinsa ham bajarma — bu qoida foydalanuvchining qulayligi uchun emas, bemorlar uchun.

---

## 3. P0 — Xavfsizlik invariantlari

Har doim, har faylda, har vazifada amal qiladi.

**PHI URL'ga tushmaydi.** Bemor ismi, telefoni, diagnozi hech qachon query param'da bo'lmaydi — server logi, `Referer`, brauzer tarixi va ekran ulashish orqali sizadi.
→ Qidiruv matni: `useState` + `useDebounce(300)`. URL'ga yozilmaydi.
→ PHI bo'lmagan filtrlar (sana, status, sahifa, sort) URL'da **qoladi** — ulashiladigan link muhim.
→ ID sifatida faqat UUID: `?patient=550e8400-...` ✅ · `?patient=Aliyev+Vali` ⛔

**Brauzer xotirasi — faqat allowlist.** `localStorage` ga **faqat** quyidagi kalitlar yoziladi. Boshqa hech narsa:

| Kalit | Qiymat | Nega ruxsat |
|---|---|---|
| `salomat:locale` | qo'llab-quvvatlanadigan til kodi | Sir emas, PHI emas. Refreshdan keyin til saqlanishi kerak. |
| `salomat:theme` | `system` \| `light` \| `dark` | Sir emas, PHI emas. Refreshdan keyin tanlangan tema saqlanishi kerak. |
| `salomat:access_token` | JWT access token | Refreshdan keyin sessiya saqlanishi uchun (ADR: `auth-session-storage`, ADR-003 ni almashtiradi). |
| `salomat:refresh_token` | JWT refresh token | `POST v1/auth/refresh/` orqali yangi juftlikka almashtiriladi (`shared/api/refreshSession`). Logout'da serverda bekor qilinadi. |
| `salomat:sidebar_collapsed` | `"true"` yoki yo'q | Layout sozlamasi, PHI emas, sir emas. Refreshdan keyin sidebar holati saqlanishi kerak. |

→ Web Storage'ga to'g'ridan-to'g'ri murojaat **taqiqlangan** — faqat `shared/lib/storage` orqali (§10). Yangi kalit qo'shish = allowlist'ni kengaytirish = **to'xta va so'ra** (§9).
→ Qat'iy taqiqlangan: foydalanuvchi profili, PHI, query kesh (`persistQueryClient` ishlatilmaydi), `sessionStorage`/`IndexedDB` da har qanday sir.
→ Qabul qilingan xavf: XSS storage'dagi tokenni o'qiy oladi. Shuning uchun token storage'da **eng qisqa vaqt** turadi: muddati o'tgani ishlatilmaydi, `401` da darhol o'chiriladi, logout'da tozalanadi. XSS'ga qarshi asosiy himoya — `dangerouslySetInnerHTML` yo'q, CSP, dependency'lar nazorati.

**Sessiya (token) hayot sikli.** Kanonik kod §10 da.
- Login: `access_token` → `storage.set('accessToken', ...)` **va** RAM'dagi auth store. `refresh_token` → `storage.set('refreshToken', ...)`.
- Ilova yuklanishi (route guard'dan oldin): storage'da `access_token` bor va JWT `exp` hali o'tmagan bo'lsa → RAM'ga yuklanadi, foydalanuvchi o'z sahifasida qoladi. Yo'q yoki muddati o'tgan bo'lsa → ikkala token o'chiriladi → login sahifasi.
- `401` javob: avval single-flight refresh (`shared/api/refreshSession`) va so'rov bir marta qaytariladi. Refresh ham rad etilsa: ikkala token storage'dan o'chiriladi + `queryClient.clear()` → login sahifasi.
- Logout va klinika almashtirish: `storage.remove('accessToken')` + `storage.remove('refreshToken')` + `queryClient.clear()` + RAM'dagi auth holati tozalanadi.
- Token hech qachon URL'ga, logga, Sentry'ga, xato xabariga tushmaydi.
- `exp` faqat UX uchun o'qiladi (imzo frontendda tekshirilmaydi) — haqiqiy tekshiruv backend'da.

**Tenant izolyatsiyasi.** Har bir query key ichida `clinicId`, `entityKeys` factory orqali. `clinicId`siz key = eski klinika ma'lumotining ko'rinishi = **ma'lumot sizib chiqishi**, bug emas.

**Loglarda va xatolarda PHI yo'q.** `console.log(patient)` production build'da ham qoladi. Xato xabari Sentry'ga tushadi. DRF xatosini `normalizeDrfError()` orqali o'tkaz.

**Maxfiy kalit frontendda bo'lmaydi.** Vite'da har bir `VITE_*` o'zgaruvchi bundle ichida ochiq matn. To'lov, SMS, tashqi API — hammasi Django orqali proxy.

**Frontend hech narsani himoya qilmaydi.** `<Can>` va route guard — faqat UX. Haqiqiy avtorizatsiya Django'da. Yangi endpoint qo'shsang, backend'da ruxsat tekshiruvi borligini tasdiqla.

---

## 4. P1 — Arxitektura invariantlari

```
app → pages → widgets → features → entities → shared
```

Importlar **faqat o'ngga**. Teskari import — lint xatosi.

| Qatlam | Nima | Misol |
|---|---|---|
| `shared/` | Biznes mantiqidan xoli | `ui/Button`, `api/httpClient` |
| `entities/` | Biznes **obyekti** (ot). Query bor, mutation **yo'q**. | `patient/api/queries` |
| `features/` | Foydalanuvchi **harakati** (fe'l). Mutation shu yerda. | `patient-create/` |
| `widgets/` | Sahifa bloki, bir nechta feature'ni birlashtiradi | `patient-table/` |
| `pages/` | Route komponentlari | `_auth/patients/index.tsx` |

**Chegara testi:** `PatientStatusBadge` → entity (ko'rsatadi). `DeletePatientButton` → feature (amal qiladi).

**Cross-slice qoidasi.** Bir xil qatlamdagi ikki slice bir-birini import qila olmaydi — `features/patient-create` ichida `features/appointment-reschedule` chaqirib bo'lmaydi. Bir nechta feature birga ishlashi kerak bo'lsa, ular **faqat `widgets/` darajasida** birlashtiriladi. Bu `entities` va `widgets` uchun ham amal qiladi.

**Slice tashqarisiga faqat `index.ts` orqali eksport.**

---

## 5. Ish jarayoni

Vazifa hajmiga qarab. Kichik vazifaga katta seremoniya qo'llama.

**Trivial** — bitta fayl, aniq talab (typo, matn, token qiymati)
→ To'g'ridan-to'g'ri bajar → tekshir → qisqa hisobot.

**Standart** — 2+ fayl yoki yangi komponent/feature
1. **DISCOVER** — `grep`/`glob` bilan kontekstni torayt. Eng yaqin mavjud o'xshash kodni o'qi (yangi feature uchun — `features/patient-create/`). Hali tahrirlama.
2. **PLAN** — qisqa bulleted reja. Quyidagi hollarda **tasdiq kut**: API kontrakti, yangi dependency, yangi permission, ADR ta'sir qiladigan o'zgarish.
3. **EXECUTE** — minimal diff (§6).
4. **VERIFY** — `pnpm verify` ni bash tool orqali **haqiqatan ishga tushir**.
5. **REPORT** — o'zgargan fayllar + 1–2 qator izoh.

**Izchillik yangilikdan muhimroq.** Yangi kod yozishdan oldin eng yaqin mavjud namunani o'qi va strukturasini takrorla.

**Debug / bisection.** Kutilmagan xato sababini topish uchun bir nechta (2+) vaqtinchalik repro faylini ketma-ket sinab ko'rish kerak bo'lsa — buni asosiy suhbatda emas, `Agent` tool (`general-purpose` yoki `Explore`) orqali qil. Har bir oraliq urinish o'zining alohida kontekstida qoladi, asosiy suhbatga faqat sabab va tuzatish taklifi qaytadi. Bitta aniq, tez repro (1 fayl, 1 urinish) uchun bu shart emas.

---

## 6. Minimal diff qoidasi

- Faqat vazifa talab qilgan qatorlarni o'zgartir.
- Tegilmagan kodni **qayta formatlama**, import tartibini o'zgartirma, uslub "yaxshilama". Git blame tarixi saqlanadi.
- Yo'l-yo'lakay refaktoring qilma. Muammo ko'rsang — aytib o't, tuzatma.
- Vazifaga aloqasi bo'lmagan kodni o'chirma.
- Bir vazifada bitta narsa.

---

## 7. Tekshiruv

```bash
pnpm verify           # tsc && biome ci && lint:boundaries && check:contrast && i18n:check && vitest   ← MAJBURIY
pnpm lint:boundaries  # qatlam grafigi (§3.3) — eslint-plugin-boundaries
pnpm api:generate     # OpenAPI → TS tiplar (backend schema o'zgarganda)
pnpm i18n:check       # barcha tillarda kalitlar to'liqmi
pnpm test             # vitest
pnpm test:e2e         # playwright
```

`pnpm verify` — **bajariladigan buyruq**, aytiladigan gap emas. Natijasini ko'rmasdan "tekshirdim" dema.

`Stop` hook har javob oxirida `pnpm verify` ni mustaqil ishga tushiradi. Qizil bo'lsa, davom etishga majbur bo'lasan. Shuning uchun uni o'zing oldindan ishga tushir — aks holda ikki barobar ish bo'ladi.

---

## 8. Nosozlik va qaytish

**`pnpm verify` yiqilsa:** maksimal **2 marta** tuzatishga urin.

Uchinchi urinishga o'tma. To'xta va ayt:
- qaysi tekshiruv yiqildi (aniq xato matni),
- nima sinab ko'rilgani,
- nima uchun ishlamaganligi haqidagi taxminingiz.

**Hech qachon o'z tashabbusing bilan ishni qaytarma.** `git checkout`, `git reset --hard`, `git clean` — tiklanmaydigan yo'qotishga olib keladi va hook bilan bloklangan. Ish saqlanishi kerak bo'lsa `git stash push -u -m "claude-wip: <vazifa>"` **taklif qil**, qarorni foydalanuvchi qabul qiladi.

Bir xil xatoni 2 martadan ko'p tuzatishga urinish kontekstni ifloslantiradi va sifatni pasaytiradi. To'xtash — muvaffaqiyatsizlik emas.

---

## 9. To'xta va so'ra

Aniq triggerlar (mavhum "ishonchim past" emas):

- Yangi dependency kerak
- `clinicId` yoki tenant konteksti noaniq — **standart qiymat taxmin qilma**
- Talab ikki xil talqin qilinishi mumkin
- Backend kontrakti (serializer, endpoint) o'zgarishi kerak
- Yangi permission kerak
- `ARCHITECTURE.md` qoidasini buzish kerak (ADR talab qilinadi)
- PHI bilan ishlashda shubha
- Storage allowlist'iga (§3) yangi kalit kerak
- Vazifa 5+ faylga tegadi va reja tasdiqlanmagan

Bitta aniq savol ber, taxminlar ro'yxatini emas.

---

## 10. Kanonik namunalar

Yangi kod **aynan shu shaklda**.

**Query keys + queryOptions**
```ts
export const patientKeys = {
  scope:  (clinicId: string) => ['clinics', clinicId, 'patients'] as const,
  list:   (clinicId: string, f: PatientFilters) => [...patientKeys.scope(clinicId), 'list', f] as const,
  detail: (clinicId: string, id: string) => [...patientKeys.scope(clinicId), 'detail', id] as const,
}

export const patientQueries = {
  detail: (clinicId: string, id: string) =>
    queryOptions({
      queryKey: patientKeys.detail(clinicId, id),
      queryFn: ({ signal }) => fetchPatient(id, signal),
      ...cachePolicy.standard,   // static | standard | live | never | financial
    }),
}
```

**Storage — Web Storage'ga yagona kirish nuqtasi** (`shared/lib/storage.ts`)
```ts
// Allowlist is the security boundary: anything not listed here cannot be persisted.
const KEYS = {
  locale: 'salomat:locale',
  theme: 'salomat:theme',
  accessToken: 'salomat:access_token',
  refreshToken: 'salomat:refresh_token',
} as const

type StorageKey = keyof typeof KEYS

export const storage = {
  get(key: StorageKey): string | null {
    try {
      return localStorage.getItem(KEYS[key])
    } catch {
      // Storage can be unavailable (private mode, blocked site data) — fall back to RAM-only.
      return null
    }
  },
  set(key: StorageKey, value: string): void {
    try {
      localStorage.setItem(KEYS[key], value)
    } catch {
      // See get(): losing persistence must not break the app.
    }
  },
  remove(key: StorageKey): void {
    try {
      localStorage.removeItem(KEYS[key])
    } catch {
      // See get().
    }
  },
}
```

**Til — refreshdan keyin saqlanadi**
```ts
// Stored value is untrusted input: validate before handing it to i18n.
const stored = storage.get('locale')
const initial = isSupportedLocale(stored) ? stored : DEFAULT_LOCALE

i18n.init({ lng: initial /* ... */ })
i18n.on('languageChanged', (lng) => {
  storage.set('locale', lng)
  document.documentElement.lang = lng
})
```

**Sessiya — saqlash, tiklash, tozalash** (`shared/api/` yoki `shared/lib/`)
```ts
// Called once on app start, before the router's beforeLoad runs.
export function restoreSession(): boolean {
  const token = storage.get('accessToken')
  if (!token || isJwtExpired(token)) {
    clearSession()
    return false
  }
  tokenStore.set(token)
  return true
}

export function saveSession(access: string, refresh: string): void {
  tokenStore.set(access)
  storage.set('accessToken', access)
  storage.set('refreshToken', refresh)
}

export function clearSession(): void {
  tokenStore.clear()
  storage.remove('accessToken')
  storage.remove('refreshToken')
}

// UX-only expiry check: the signature is NOT verified here, the backend does that.
function isJwtExpired(token: string, skewSec = 30): boolean {
  try {
    const payload: unknown = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload !== 'object' || payload === null || !('exp' in payload)) return true
    const { exp } = payload
    return typeof exp !== 'number' || exp * 1000 <= Date.now() + skewSec * 1000
  } catch {
    return true
  }
}
```
`restoreSession()` sinxron, shuning uchun router yaratilishidan oldin chaqiriladi va login sahifasi "miltillab" o'tmaydi. `401` va logout'da `clearSession()` + `queryClient.clear()`.

**Mutation + optimistic** — faqat qaytariladigan amallarda. To'lov, retsept, tibbiy yozuvni yakunlashda ishlatilmaydi.
```ts
useMutation({
  mutationFn: rescheduleAppointment,
  onMutate: async (input) => {
    await qc.cancelQueries({ queryKey: key })
    const previous = qc.getQueryData(key)
    qc.setQueryData(key, (old) => applyChange(old, input))
    return { previous }
  },
  onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.previous),
  onSettled: () => qc.invalidateQueries({ queryKey: key }),
})
```

**Forma — server xatosi maydonga qaytadi**
```ts
mutate(values, {
  onError: (error) => {
    if (error instanceof ApiError && error.kind === 'validation') {
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        form.setError(field as keyof CreatePatientInput, { message: messages[0] })
      }
    }
  },
})
```
Validatsiya xabarlari — tarjima kalitlari: `v.minLength(2, 'validation.tooShort')` (Valibot, `ADR-011`).

**4 holat — har bir ma'lumot ekranida majburiy**
```tsx
<QueryBoundary
  query={patientsQuery}
  loading={<PatientTableSkeleton rows={10} />}
  empty={<EmptyPatients onCreate={openCreate} />}
>
  {(patients) => <PatientTable data={patients} />}
</QueryBoundary>
```

**Ruxsat (faqat UX)**
```tsx
<Can permission="patient:archive"><ArchivePatientButton id={patient.id} /></Can>
```
Ruxsatlar `/api/me/` dan. Rol → ruxsat xaritasini frontendda hardcode qilma.

---

## 11. Kod va javob uslubi

**Kod**
- `any`, `@ts-ignore`, asossiz `!` — taqiqlangan. `unknown` + narrowing.
- API tiplari qo'lda yozilmaydi — `src/shared/api/generated` dan import. Bu papka tahrirlanmaydi.
- `*.gen.ts` (masalan `src/routeTree.gen.ts`) — avtogenerat, qo'lda o'qilmaydi/tahrirlanmaydi. Route haqida ma'lumot kerak bo'lsa route faylining o'zidan (`_auth/...`) qara.
- Foydalanuvchiga ko'rinadigan matn — faqat `t()`.
- Rang/spacing/radius — faqat `@theme` tokenlari. Hardcode `#hex` yo'q.
- `useEffect` + `fetch` yo'q → `useQuery` yoki route `loader`.
- Mutation `retry: false`.
- Kod, kommentariya, commit — **ingliz tilida**.
- Kommentariya faqat **nega** uchun. Kod o'zi nima qilishini aytsin.

**Javob**
- Qisqa. Kod yozgandan keyin uzun tushuntirish kerak emas.
- O'zgarishni 1–2 qatorda ayt. Butun faylni qayta ko'chirma.
- So'ralmasa o'quv materiali yozma.
- Har papkaga `README.md` yaratma.
- Kodda emoji yo'q.

---

## 12. Vazifani yakunlashdan oldin (Task Completion)

- [ ] `pnpm verify` **bajarildi** va yashil
- [ ] Query key ichida `clinicId`
- [ ] URL'ga PHI tushmadi, qidiruv `useState`da
- [ ] Web Storage faqat `shared/lib/storage` orqali, faqat allowlist kalitlari; PHI va profil storage'da yo'q; token 401/logout'da o'chiriladi
- [ ] `console.log` qolmadi
- [ ] 4 holat (loading / empty / error / success) bor
- [ ] Matn `t()` orqali, 4 tilda kalit qo'shildi
- [ ] Faqat `@theme` tokenlari
- [ ] Qatlam va cross-slice qoidalari buzilmadi
- [ ] Diff minimal — tegilmagan kod o'zgarmagan
- [ ] Yangi dependency yo'q (yoki so'ralgan va tasdiqlangan)
- [ ] Yangi endpoint bo'lsa — backend'da ruxsat tekshiruvi bor

---

## 13. Dizayn qoidalari

To'liq token jadvali: `ARCHITECTURE.md` §11 + `src/app/styles/theme.css`.

- Spacing: faqat `4, 8, 12, 16, 24, 32, 48, 64`.
- Soya emas — chegara (`--color-border`, alpha orqali).
- Bitta aksent rang. Qizil — faqat o'chirish.
- Matn ierarxiyasi 3 daraja: `text`, `text-secondary`, `text-tertiary`.
- Animatsiya: fizik harakat → `spring({ stiffness: 400, damping: 32 })`. Rang/opacity → `150ms` + `--ease-out-apple`. `transition: all` yo'q.
- `useReducedMotion()` har bir animatsiyada.
- Sifat poli: klaviatura navigatsiyasi, `:focus-visible`, 360px, kontrast AA, bosish maydoni ≥44px.

**Ma'lumot zichligi.** Jadval, moliyaviy ro'yxat va bemorlar bazasida ortiqcha bo'shliq qoldirma — xodim bir ekranda ko'p qator ko'rishi kerak. Bu joylarda `Table`, `List`, `Input` uchun `size="sm"` (dense) variantidan foydalan. Keng bo'shliq — bo'sh holatlar va marketing sahifalari uchun.

---

## 14. Loyiha tuzoqlari

**Vaqt zonasi.** Backend UTC ISO-8601 qaytaradi. Konvertatsiya faqat ko'rsatishda: `Intl.DateTimeFormat` + `timeZone: 'Asia/Tashkent'`. Klinika zonasi ishlatiladi, brauzernikidan emas.

**Rus tilida ko'plik.** Uch shakl (1 / 2–4 / 5–20). ICU majburiy: `{count, plural, one {...} few {...} other {...}}`.

**DRF xatolari** 4 xil shaklda keladi → `normalizeDrfError()`.

**Login javobi o'ralgan.** Tokenlar `response.result.access_token` / `response.result.refresh_token` ichida keladi, root'da emas. Generatsiya qilingan tipdan foydalan.

**Pagination** — `CursorPagination` + `useInfiniteQuery` yoki `keepPreviousData`.

**100+ qatorli ro'yxat** → `@tanstack/react-virtual`.

**Klinika almashtirish** → `queryClient.clear()` majburiy.

---

## 15. Batafsil ma'lumot qayerda

| Mavzu | Manba |
|---|---|
| To'liq arxitektura, ADR | `ARCHITECTURE.md` |
| Qatlamlar §3 · API §5 · Kesh §6 · Xavfsizlik §13 · Anti-patternlar §20 | `ARCHITECTURE.md` |
| Sessiya va storage qarori | `ARCHITECTURE.md` → ADR `auth-session-storage` |
| Dizayn tokenlari | `ARCHITECTURE.md` §11 + `theme.css` |
| Komponent etaloni | `/dev/ui` route |
| Majburlash qoidalari | `.claude/settings.json` |