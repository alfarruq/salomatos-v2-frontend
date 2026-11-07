/**
 * The four locales from ADR-008.
 *
 * `uz-Latn` and `uz-Cyrl` are two locales, not one script-switched locale
 * (§12.5). Transliterating between them mechanically gets spelling and some
 * terminology wrong, and a medical interface is the wrong place to be
 * approximately right.
 */
export const LOCALES = ['uz-Latn', 'uz-Cyrl', 'ru', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'uz-Latn'

/** Shown in the language switcher, each in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  'uz-Latn': "O'zbekcha",
  'uz-Cyrl': 'Ўзбекча',
  ru: 'Русский',
  en: 'English',
}

/**
 * Namespaces load on demand (§12.1) — a receptionist working in the patient
 * list does not download the billing translations.
 */
export const NAMESPACES = [
  'common',
  'auth',
  'validation',
  'patients',
  'admin',
  'appointments',
  'treatments',
  'recipes',
  'dashboard',
  'finance',
  'expenses',
  'statistics',
] as const

export type Namespace = (typeof NAMESPACES)[number]

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * Maps whatever the browser reports to a locale we have.
 *
 * `uz` alone is ambiguous, so it resolves to Latin — the script in official use
 * — rather than guessing from the region.
 */
export function resolveLocale(candidates: readonly string[]): Locale {
  for (const candidate of candidates) {
    if (isLocale(candidate)) return candidate

    const [language, script] = candidate.split('-')
    if (language === 'uz') return script === 'Cyrl' ? 'uz-Cyrl' : 'uz-Latn'
    if (language === 'ru') return 'ru'
    if (language === 'en') return 'en'
  }
  return DEFAULT_LOCALE
}
