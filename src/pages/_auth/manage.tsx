import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'

/**
 * The sections of the admin area, in one list.
 *
 * Adding one means adding a route file and an entry here — the navigation, the
 * ordering and the active state all read from this. Kept deliberately small so
 * that it stays the only place a section is declared.
 */
const SECTIONS = [
  { to: '/manage/doctors', labelKey: 'admin:nav.doctors' },
  { to: '/manage/doctor-types', labelKey: 'admin:nav.doctorTypes' },
  { to: '/manage/admins', labelKey: 'admin:nav.admins' },
  { to: '/manage/services', labelKey: 'admin:nav.services' },
  { to: '/manage/clinic', labelKey: 'admin:nav.clinic' },
] as const

/**
 * Branch administration: staff, specialties, the price list, the profile.
 *
 * UX only (§3): every endpoint behind it checks its own permission on the
 * server. This guard just keeps a doctor from landing on screens they cannot use.
 */
export const Route = createFileRoute('/_auth/manage')({
  beforeLoad: ({ context }) => {
    // Owners and branch admins manage staff; a doctor is sent back rather than shown an empty shell.
    if (!context.session.permissions.has('staff:manage')) {
      throw redirect({ to: '/dashboard' })
    }
  },

  component: AdminLayout,
})

function AdminLayout() {
  const { t } = useTranslation(['admin', 'common'])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-title1 text-text">{t('admin:title')}</h1>
        <p className="text-callout text-text-secondary">{t('admin:subtitle')}</p>
      </div>

      {/*
       * A nav rather than a tab list: each section is its own route, so the
       * back button works and a link to one can be sent to somebody (§7.3).
       */}
      <nav aria-label={t('admin:title')}>
        <ul className="flex gap-1 overflow-x-auto border-b border-border">
          {SECTIONS.map((section) => (
            <li className="shrink-0" key={section.to}>
              <Link
                activeProps={{ 'data-active': 'true' }}
                className={cn(
                  'block rounded-t-control px-4 py-2 text-body whitespace-nowrap text-text-secondary',
                  'border-b-2 border-transparent transition-colors duration-150 ease-out-apple',
                  'hover:text-text data-[active=true]:border-accent data-[active=true]:text-text',
                )}
                to={section.to}
              >
                {t(section.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  )
}
