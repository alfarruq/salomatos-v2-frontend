import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { Permission } from '@/entities/session'
import { useCan } from '@/entities/session'
import { cn } from '@/shared/lib/cn'

/** The finance tabs in one list; each one shows only to a role its server endpoints accept. */
const TABS = [
  { to: '/finance', labelKey: 'tabs.overview', exact: true, permission: 'report:view' },
  { to: '/finance/debtors', labelKey: 'tabs.debtors', exact: false, permission: 'payment:view' },
  { to: '/finance/expenses', labelKey: 'tabs.expenses', exact: false, permission: 'expense:view' },
  {
    to: '/finance/recurring',
    labelKey: 'tabs.recurring',
    exact: false,
    permission: 'expense:view',
  },
  { to: '/finance/payroll', labelKey: 'tabs.payroll', exact: false, permission: 'payroll:view' },
] as const satisfies readonly {
  to: string
  labelKey: string
  exact: boolean
  permission: Permission
}[]

export const Route = createFileRoute('/_auth/finance')({
  component: FinanceLayout,
})

function FinanceLayout() {
  const { t } = useTranslation('finance')
  const allowed = {
    'report:view': useCan('report:view'),
    'payment:view': useCan('payment:view'),
    'expense:view': useCan('expense:view'),
    'payroll:view': useCan('payroll:view'),
  }
  const tabs = TABS.filter((tab) => allowed[tab.permission])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title1 text-text">{t('title')}</h1>

      {/* A nav, not a tab list: each tab is its own route, so links and the back button work. */}
      {tabs.length > 1 ? (
        <nav aria-label={t('title')}>
          <ul className="flex gap-1 overflow-x-auto border-b border-border">
            {tabs.map((tab) => (
              <li className="shrink-0" key={tab.to}>
                <Link
                  activeOptions={{ exact: tab.exact, includeSearch: false }}
                  activeProps={{ 'data-active': 'true' }}
                  className={cn(
                    'block rounded-t-control px-4 py-2 text-body whitespace-nowrap text-text-secondary',
                    'border-b-2 border-transparent transition-colors duration-150 ease-out-apple',
                    'hover:text-text data-[active=true]:border-accent data-[active=true]:text-text',
                  )}
                  to={tab.to}
                >
                  {t(tab.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <Outlet />
    </div>
  )
}
