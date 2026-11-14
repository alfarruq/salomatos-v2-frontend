import { useQuery } from '@tanstack/react-query'
import { Eye, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BotAccessDetails, type BotAccessTarget, botAccessQueries } from '@/entities/bot-access'
import { useCan } from '@/entities/session'
import { Button, Dialog, ErrorState, QueryBoundary, Skeleton, toast } from '@/shared/ui'
import { useResetBotAccess } from '../model/useResetBotAccess'

export interface BotAccessPanelProps {
  clinicId: string
  target: BotAccessTarget
}

/**
 * A Telegram bot login and, for a patient or a staff member, the reset that
 * replaces its password. The caller's own login has no reset here: the owner
 * resets staff logins, and a lost one is theirs to ask for.
 */
export function BotAccessPanel({ clinicId, target }: BotAccessPanelProps) {
  const { t } = useTranslation(['bot', 'common'])
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  // Fetched on request only: every read is audited on the server, and a
  // password should not sit on screen for anyone walking past the desk.
  // A patient's login is shown straight away: anyone who can open the card may read it anyway.
  const [isClicked, setRevealed] = useState(false)
  const isRevealed = isClicked || target.kind === 'patient'
  // Reset is a write, so the all-branches view (read-only) does not offer it.
  const canReset = useCan(target.kind === 'patient' ? 'patient:manage' : 'staff:manage')
  const query = useQuery({ ...botAccessQueries.detail(clinicId, target), enabled: isRevealed })
  const reset = useResetBotAccess(clinicId)

  const confirmReset = () => {
    if (target.kind === 'mine') return
    reset.mutate(target, {
      onSuccess: () => {
        setConfirmOpen(false)
        setRevealed(true)
        toast.success(t('bot:reset.success'))
      },
      onError: () => toast.error(t('bot:reset.error')),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {isRevealed ? null : (
        <div>
          <Button
            iconLeft={<Eye aria-hidden="true" className="size-4" />}
            onClick={() => setRevealed(true)}
            size="sm"
            variant="secondary"
          >
            {t('bot:show')}
          </Button>
        </div>
      )}

      {isRevealed ? (
        <QueryBoundary
          error={({ retry }) => (
            <ErrorState
              description={t('common:error.pageBody')}
              retryLabel={t('common:action.retry')}
              title={t('bot:error')}
              {...(retry === undefined ? {} : { onRetry: retry })}
            />
          )}
          isEmpty={() => false}
          loading={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
          }
          query={query}
        >
          {(access) => <BotAccessDetails access={access} />}
        </QueryBoundary>
      ) : null}

      {target.kind === 'mine' || !canReset ? null : (
        <div>
          <Button
            iconLeft={<KeyRound aria-hidden="true" className="size-4" />}
            onClick={() => setConfirmOpen(true)}
            size="sm"
            variant="secondary"
          >
            {t('bot:reset.open')}
          </Button>
        </div>
      )}

      <Dialog
        description={t('bot:reset.description')}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmOpen(false)} variant="secondary">
              {t('common:action.cancel')}
            </Button>
            <Button isLoading={reset.isPending} onClick={confirmReset} variant="primary">
              {t('bot:reset.confirm')}
            </Button>
          </div>
        }
        onOpenChange={setConfirmOpen}
        open={isConfirmOpen}
        title={t('bot:reset.title')}
      />
    </div>
  )
}
