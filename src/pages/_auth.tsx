import { useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  type LinkProps,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import {
  CalendarDays,
  House,
  LogOut,
  type LucideIcon,
  Settings,
  Stethoscope,
  Users,
  Wallet,
} from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Can, sessionQueries, useSession } from '@/entities/session'
import { useLogout } from '@/features/auth-logout'
import { ScopeSwitcher } from '@/features/clinic-switch'
import { LanguageSwitcher } from '@/features/language-switch'
import { LockScreen, useIdleLock, useLockStore } from '@/features/session-lock'
import { ThemeSwitcher } from '@/features/theme-switch'
import { clearSession } from '@/shared/api/authSession'
import { ApiError } from '@/shared/api/errors'
import { cn } from '@/shared/lib/cn'
import {
  Alert,
  AppShell,
  Avatar,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Logo,
  PullToRefresh,
  Tooltip,
  tabBarItemClassName,
  useSidebarCollapsed,
} from '@/shared/ui'

/**
 * The authentication guard, in one place (§8.2). Repeating it per page is how a
 * screen eventually ships without it.
 *
 * ⚠️ This is UX, not security (§9.1). It stops an unauthenticated user seeing an
 * empty shell; what actually protects the data is Django refusing the request.
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    // `ensureQueryData` reads the cache when it is fresh, so navigating between
    // pages does not re-ask the server who you are.
    const session = await context.queryClient
      .ensureQueryData(sessionQueries.me())
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === 'unauthorized') {
          throw redirect({ to: '/login', search: { redirect: location.href } })
        }
        if (error instanceof ApiError && error.messageKey === 'no_clinic') {
          clearSession()
          context.queryClient.clear()
          throw redirect({ to: '/login', search: { denied: 'no_clinic' } })
        }
        throw error
      })

    return { session, clinicId: session.clinicId }
  },

  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const session = useSession()
  const { mutate: logout, isPending } = useLogout()

  const isLocked = useLockStore((state) => state.isLocked)
  useIdleLock(session)

  const handleLogout = () => {
    logout(undefined, {
      onSettled: () => navigate({ to: '/login' }),
    })
  }

  /*
   * §13.4 — returned before the shell, not layered over it. By this point the
   * cache is already empty, so there is nothing underneath worth hiding; not
   * rendering the app at all also keeps its keyboard traps out of the way.
   */
  if (isLocked) {
    return (
      <LockScreen
        onSignOut={() => {
          useLockStore.getState().unlock()
          handleLogout()
        }}
      />
    )
  }

  return (
    <AppShell
      brand={<SidebarBrand />}
      headerActions={
        session ? (
          <>
            <ScopeSwitcher session={session} />
            <ThemeSwitcher />
            <LanguageSwitcher />
            <DropdownMenu
              trigger={
                <button aria-label={session.fullName} className="rounded-full" type="button">
                  <Avatar name={session.fullName} />
                </button>
              }
            >
              <DropdownMenuLabel>{session.email ?? session.fullName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isPending}
                iconLeft={<LogOut aria-hidden="true" className="size-4" />}
                onSelect={handleLogout}
              >
                {t('action.signOut')}
              </DropdownMenuItem>
            </DropdownMenu>
          </>
        ) : null
      }
      labels={{
        skipToContent: t('nav.skipToContent'),
        openNavigation: t('nav.openNavigation'),
        navigation: t('nav.navigation'),
        collapseNavigation: t('nav.collapseNavigation'),
        expandNavigation: t('nav.expandNavigation'),
        more: t('nav.more'),
      }}
      tabBar={
        <>
          <Link
            activeProps={{ 'data-active': 'true' }}
            className={tabBarItemClassName}
            to="/dashboard"
          >
            <House aria-hidden="true" className="size-6" />
            {t('nav.dashboard')}
          </Link>
          <Can permission="patient:view">
            <Link
              activeProps={{ 'data-active': 'true' }}
              className={tabBarItemClassName}
              to="/patients"
            >
              <Users aria-hidden="true" className="size-6" />
              {t('nav.patients')}
            </Link>
          </Can>
          <Can permission="appointment:view">
            <Link
              activeProps={{ 'data-active': 'true' }}
              className={tabBarItemClassName}
              to="/appointments"
            >
              <CalendarDays aria-hidden="true" className="size-6" />
              {t('nav.appointments')}
            </Link>
          </Can>
        </>
      }
      sidebar={
        <ul className="flex flex-col gap-1">
          <li>
            <SidebarLink icon={House} label={t('nav.dashboard')} to="/dashboard" />
          </li>
          {/* Nothing here is a permission check that matters — Django's is. */}
          <Can permission="patient:view">
            <li>
              <SidebarLink icon={Users} label={t('nav.patients')} to="/patients" />
            </li>
          </Can>
          {/* Treatments are medical records — doctors and the desk both read them. */}
          <Can permission="procedure:view">
            <li>
              <SidebarLink icon={Stethoscope} label={t('nav.treatments')} to="/treatments" />
            </li>
          </Can>
          <Can permission="appointment:view">
            <li>
              <SidebarLink icon={CalendarDays} label={t('nav.appointments')} to="/appointments" />
            </li>
          </Can>
          <Can permission="payment:view">
            <li>
              <SidebarLink icon={Wallet} label={t('nav.billing')} to="/finance" />
            </li>
          </Can>
          {/* Staff, services and settings: owners and branch admins. */}
          <Can permission="staff:manage">
            <li>
              <SidebarLink icon={Settings} label={t('nav.admin')} to="/manage" />
            </li>
          </Can>
        </ul>
      }
    >
      {/* Re-asks the server for what is on screen; a full reload would also drop form drafts and filters. */}
      <PullToRefresh
        label={t('nav.refreshing')}
        onRefresh={() => queryClient.refetchQueries({ type: 'active' })}
      />
      {session?.isAllBranches ? (
        <div className="mb-4">
          <Alert tone="info" title={t('scope.allBranches')}>
            {t('scope.readOnly')}
          </Alert>
        </div>
      ) : null}
      <Outlet />
    </AppShell>
  )
}

function SidebarBrand() {
  return <Logo compact={useSidebarCollapsed()} compactBelowLg />
}

const sidebarItemClassName = cn(
  'flex items-center gap-3 rounded-control px-3 py-2 text-body whitespace-nowrap',
  'transition-colors duration-150 ease-out-apple',
)

/**
 * Icon and label. In the collapsed rail the label is hidden visually but kept
 * for screen readers, and a tooltip takes its place for sighted users.
 */
function SidebarItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: (content: ReactNode) => ReactElement
}) {
  const isCollapsed = useSidebarCollapsed()
  const item = children(
    <>
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className={cn(isCollapsed && 'sr-only')}>{label}</span>
    </>,
  )

  return isCollapsed ? (
    <Tooltip content={label} side="right">
      {item}
    </Tooltip>
  ) : (
    item
  )
}

/**
 * Fuzzy matching (the router's default) keeps a section lit on its nested
 * pages too, e.g. `/manage/doctors` under `/manage`.
 */
function SidebarLink({
  to,
  ...item
}: {
  to: NonNullable<LinkProps['to']>
  icon: LucideIcon
  label: string
}) {
  return (
    <SidebarItem {...item}>
      {(content) => (
        <Link
          activeProps={{ className: 'bg-accent-soft font-medium text-accent-text' }}
          className={sidebarItemClassName}
          inactiveProps={{ className: 'text-text-secondary hover:bg-sunken hover:text-text' }}
          to={to}
        >
          {content}
        </Link>
      )}
    </SidebarItem>
  )
}
