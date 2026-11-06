import { Building2, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@/entities/session'
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/shared/ui'
import { useSwitchScope } from '../model/useSwitchScope'

export function ScopeSwitcher({ session }: { session: Session }) {
  const { t } = useTranslation('common')
  const switchScope = useSwitchScope()

  // One clinic and nothing to aggregate: a switcher would only be noise.
  if (session.memberships.length < 2 && session.organizations.length === 0) {
    return null
  }

  const isCurrent = (kind: 'clinic' | 'organization', id: string) =>
    session.scope.kind === kind && session.scope.id === id

  return (
    <DropdownMenu
      trigger={
        <Button
          aria-label={t('scope.change')}
          iconLeft={<Building2 aria-hidden="true" className="size-4" />}
          size="sm"
          variant="ghost"
        >
          {session.isAllBranches ? t('scope.allBranches') : session.scopeName}
        </Button>
      }
    >
      <DropdownMenuLabel>{t('scope.label')}</DropdownMenuLabel>
      {session.organizations.map((organization) => (
        <DropdownMenuItem
          iconLeft={
            isCurrent('organization', organization.id) ? (
              <Check aria-hidden="true" className="size-4" />
            ) : null
          }
          key={organization.id}
          onSelect={() => switchScope({ kind: 'organization', id: organization.id })}
        >
          {t('scope.allBranchesOf', { name: organization.name })}
        </DropdownMenuItem>
      ))}
      {session.organizations.length > 0 ? <DropdownMenuSeparator /> : null}
      {session.memberships.map((membership) => (
        <DropdownMenuItem
          iconLeft={
            isCurrent('clinic', membership.clinicId) ? (
              <Check aria-hidden="true" className="size-4" />
            ) : null
          }
          key={membership.id}
          onSelect={() => switchScope({ kind: 'clinic', id: membership.clinicId })}
        >
          {membership.clinicName}
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  )
}
