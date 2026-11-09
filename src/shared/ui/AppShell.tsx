import { Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { motion } from 'motion/react'
import { createContext, type ReactNode, useContext, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { springs, useTransition } from '@/shared/lib/motion'
import { storage } from '@/shared/lib/storage'
import { Sheet } from './Sheet'
import { Tooltip, TooltipProvider } from './Tooltip'

const SidebarCollapsedContext = createContext(false)

/**
 * True while the desktop rail is collapsed to icons. Sidebar items read it to
 * hide their labels visually (they stay in the accessibility tree) and to show
 * a tooltip instead. Always false inside the small-screen sheet.
 */
export function useSidebarCollapsed(): boolean {
  return useContext(SidebarCollapsedContext)
}

/** Rail widths, matching `w-64` and `w-20`. */
const RAIL_WIDTH = { expanded: 256, collapsed: 80 } as const

export interface AppShellProps {
  /** Navigation. Rendered in the fixed rail on desktop and in a sheet below it. */
  sidebar: ReactNode
  /** Right-hand side of the top bar: search, clinic switcher, account menu. */
  headerActions?: ReactNode
  /** Product or clinic name shown in the rail. */
  brand: ReactNode
  /**
   * Primary destinations for the bottom tab bar below `lg`. When given, the
   * bar replaces the header's menu button: a thumb reaches the bottom of a
   * phone, not its top-left corner. A trailing "more" tab opens the full
   * navigation in the sheet.
   */
  tabBar?: ReactNode
  children: ReactNode
  /** Accessible names — this layer holds no copy of its own. */
  labels: {
    skipToContent: string
    openNavigation: string
    navigation: string
    collapseNavigation: string
    expandNavigation: string
    /** The tab bar's last item, which opens the full navigation. */
    more?: string
  }
  className?: string
}

/**
 * The frame every authenticated page sits in: a fixed navigation rail, a top
 * bar and a scrolling content column.
 *
 * Below `lg` the rail becomes a sheet — a clinic tablet at the reception desk
 * is a real device here, not a hypothetical.
 */
export function AppShell({
  sidebar,
  headerActions,
  brand,
  tabBar,
  children,
  labels,
  className,
}: AppShellProps) {
  const [isNavOpen, setIsNavOpen] = useState(false)
  // Stored value is untrusted input: anything but "true" means expanded.
  const [isCollapsed, setIsCollapsed] = useState(() => storage.get('sidebarCollapsed') === 'true')
  const railTransition = useTransition(springs.surface)
  const toggleLabel = isCollapsed ? labels.expandNavigation : labels.collapseNavigation
  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose

  const toggle = (
    <button
      aria-label={toggleLabel}
      className={cn(
        'flex w-full items-center gap-3 rounded-control px-3 py-2 text-body whitespace-nowrap',
        'text-text-secondary transition-colors duration-150 ease-out-apple',
        'hover:bg-sunken hover:text-text',
      )}
      onClick={() => {
        const next = !isCollapsed
        setIsCollapsed(next)
        if (next) storage.set('sidebarCollapsed', 'true')
        else storage.remove('sidebarCollapsed')
      }}
      type="button"
    >
      <ToggleIcon aria-hidden="true" className="size-5 shrink-0" />
      <span className={cn(isCollapsed && 'sr-only')}>{toggleLabel}</span>
    </button>
  )

  return (
    // Provided here rather than app-wide: only the signed-in frame uses
    // tooltips, and keeping Radix Tooltip out of the entry chunk keeps the
    // login page inside its size budget.
    <TooltipProvider delayDuration={300}>
      <SidebarCollapsedContext.Provider value={isCollapsed}>
        <div className={cn('min-h-dvh bg-canvas', className)}>
          {/*
           * First thing in the tab order: a keyboard user should not have to walk
           * the whole navigation on every page to reach the content (§11.7).
           */}
          <a
            className={cn(
              'sr-only focus:not-sr-only',
              'focus:absolute focus:top-4 focus:left-4 focus:z-50',
              'focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent',
            )}
            href="#main"
          >
            {labels.skipToContent}
          </a>

          <div className="flex">
            <motion.nav
              animate={{ width: isCollapsed ? RAIL_WIDTH.collapsed : RAIL_WIDTH.expanded }}
              aria-label={labels.navigation}
              className={cn(
                'hidden lg:flex',
                // Clipped so labels do not spill out while the width springs.
                'sticky top-0 h-dvh shrink-0 flex-col gap-6 overflow-hidden',
                'border-r border-border bg-surface p-4',
              )}
              data-collapsed={isCollapsed}
              initial={false}
              transition={railTransition}
            >
              {brand}
              <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
              {isCollapsed ? (
                <Tooltip content={toggleLabel} side="right">
                  {toggle}
                </Tooltip>
              ) : (
                toggle
              )}
            </motion.nav>

            <div className="flex min-w-0 flex-1 flex-col">
              <header
                className={cn(
                  'sticky top-0 z-40 flex h-16 items-center gap-3',
                  'border-b border-border bg-surface/80 px-4 backdrop-blur',
                )}
              >
                <button
                  aria-label={labels.openNavigation}
                  className={cn(
                    'flex size-11 items-center justify-center rounded-control lg:hidden',
                    tabBar !== undefined && 'hidden',
                    'text-text-secondary transition-colors duration-150 ease-out-apple',
                    'hover:bg-sunken hover:text-text',
                  )}
                  onClick={() => setIsNavOpen(true)}
                  type="button"
                >
                  <Menu aria-hidden="true" className="size-5" />
                </button>

                <div className="lg:hidden">{brand}</div>

                <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
                  {headerActions}
                </div>
              </header>

              {/* `min-w-0` above and here so a wide table scrolls itself instead of
              stretching the whole layout. */}
              <main
                className={cn(
                  'min-w-0 flex-1 p-4 lg:p-6',
                  // Room for the fixed tab bar and the home indicator below it.
                  tabBar !== undefined && 'pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-6',
                )}
                id="main"
              >
                {children}
              </main>
            </div>
          </div>

          {tabBar === undefined ? null : (
            <nav
              aria-label={labels.navigation}
              className={cn(
                'fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col lg:hidden',
                'border-t border-border bg-surface/90 px-2 pt-1 backdrop-blur',
                'pb-[calc(4px+env(safe-area-inset-bottom))]',
              )}
            >
              {tabBar}
              <button
                className={tabBarItemClassName}
                onClick={() => setIsNavOpen(true)}
                type="button"
              >
                <MoreHorizontal aria-hidden="true" className="size-6" />
                {labels.more ?? labels.openNavigation}
              </button>
            </nav>
          )}

          <Sheet onOpenChange={setIsNavOpen} open={isNavOpen} title={labels.navigation}>
            <SidebarCollapsedContext.Provider value={false}>
              {/*
               * Client-side navigation keeps this component mounted, so the sheet
               * would stay open over the page the user just asked for. Delegated so
               * the sidebar can stay plain links that know nothing about the sheet.
               */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: the links inside are the interactive elements; this only observes their clicks. */}
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: Enter on a link fires click, so keyboard users are covered. */}
              <div
                onClick={(event) => {
                  if (event.target instanceof Element && event.target.closest('a') !== null) {
                    setIsNavOpen(false)
                  }
                }}
              >
                {sidebar}
              </div>
            </SidebarCollapsedContext.Provider>
          </Sheet>
        </div>
      </SidebarCollapsedContext.Provider>
    </TooltipProvider>
  )
}

/**
 * Shared by the "more" tab and the caller's links so every tab looks the same.
 * Callers mark the current page with `data-active="true"`.
 */
export const tabBarItemClassName = cn(
  // Top-aligned and centred: a label that wraps to two lines (long uz/ru
  // words) must not push its icon out of line with the other tabs.
  'flex min-h-14 min-w-0 flex-col items-center justify-start gap-1 rounded-control px-1 pt-2',
  'text-center text-caption leading-tight font-medium text-text-tertiary',
  'transition-colors duration-150 ease-out-apple',
  'data-[active=true]:text-accent-text',
)
