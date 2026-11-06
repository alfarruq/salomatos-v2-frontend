import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import * as v from 'valibot'
import { sessionQueries } from '@/entities/session'
import { LoginForm } from '@/features/auth-login'
import { Alert, Card, Logo } from '@/shared/ui'

const searchSchema = v.object({
  /**
   * Where to go back to after signing in.
   *
   * ⛔ Validated as an app-relative path on purpose. Accepting an arbitrary URL
   * here is an open redirect: a link to /login?redirect=https://evil.example
   * would send a receptionist somewhere else immediately after they typed
   * their password. The `(?!\/)` also rejects `//evil.example`, which browsers
   * read as protocol-relative and would resolve off-site.
   */
  redirect: v.optional(v.pipe(v.string(), v.regex(/^\/(?!\/)/, 'must be an app-relative path'))),
  /**
   * Why the guard sent them back, when it did.
   *
   * A closed set rather than a message: anything the URL carries is
   * attacker-controlled, and rendering arbitrary text from a search parameter
   * is how a login page ends up displaying someone else's instructions.
   */
  denied: v.optional(v.picklist(['no_clinic'])),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => v.parse(searchSchema, search),

  beforeLoad: async ({ context }) => {
    // Already signed in? Do not show a login form.
    const session = await context.queryClient.ensureQueryData(sessionQueries.me()).catch(() => null)
    if (session !== null) {
      throw redirect({ to: '/dashboard' })
    }

    /*
     * Nobody is signed in, and this is where an expired session lands. Drop
     * anything the previous user could see — §13.4, and the reception desk is
     * shared. Safe to do here: the request above has already settled, so
     * nothing gets cancelled.
     */
    context.queryClient.clear()
  },

  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const search = Route.useSearch()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-8 flex flex-col gap-2">
          {/* The wordmark is the product name, so it is the heading rather than sitting above a copy of it. */}
          <h1 className="mb-2">
            <Logo size="lg" />
          </h1>
          <p className="text-callout text-text-secondary">{t('login.subtitle')}</p>
        </div>

        {/* Informational, not an error: the credentials were correct. */}
        {search.denied === 'no_clinic' ? (
          <div className="mb-6">
            <Alert title={t('login.noClinic')} tone="info">
              {t('login.noClinicBody')}
            </Alert>
          </div>
        ) : null}

        <LoginForm
          onSuccess={() => {
            navigate({ to: search.redirect ?? '/dashboard' })
          }}
        />
      </Card>
    </main>
  )
}
