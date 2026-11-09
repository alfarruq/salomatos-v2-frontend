import { useQuery } from '@tanstack/react-query'
import { Mic, MicOff, Sparkles } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/shared/api/errors'
import { useSpeechRecognition } from '@/shared/lib/useSpeechRecognition'
import { Alert, Button, Select, Textarea } from '@/shared/ui'
import { voiceQueries } from '../api/queries'

const SPEECH_LANGUAGES = ['uz-UZ', 'ru-RU'] as const
type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number]

const MIN_TEXT = 3

export interface VoicePanelProps {
  clinicId: string
  /** What to say for this form, e.g. "name, phone, complaint". */
  hint: string
  onSubmit: (text: string) => void
  isPending: boolean
  /** The last draft request's error, if any. */
  error: unknown
  /** Set when the form cannot take a draft yet, e.g. no doctor chosen. */
  disabledReason?: string | null
  /** What the form did with the last draft: unmatched items, patient choices. */
  children?: ReactNode
}

/**
 * Dictation for any form: the browser turns speech into text, the backend
 * turns the text into a draft, and the form fills its own fields. Nothing is
 * saved here — the doctor reviews the form and presses its own save button.
 *
 * Until the clinic has a key on the server the button still shows, and opens
 * an explanation instead of the recorder: a feature that silently vanishes
 * reads as broken. Callers wrap it in `<Can permission="voice:use">`: an
 * entity cannot read the session (§4).
 */
export function VoicePanel(props: VoicePanelProps) {
  const statusQuery = useQuery(voiceQueries.status(props.clinicId))
  if (statusQuery.isPending) return null
  if (statusQuery.data?.isEnabled !== true) return <VoiceNotConfigured />
  return (
    <VoicePanelBody
      {...props}
      monthlyLimit={statusQuery.data.monthlyLimit}
      usedThisMonth={statusQuery.data.usedThisMonth}
    />
  )
}

function VoiceNotConfigured() {
  const { t } = useTranslation('voice')
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        size="sm"
        variant="ghost"
      >
        <Mic aria-hidden="true" className="size-4" />
        {t('open')}
      </Button>
      {isOpen ? (
        <Alert className="w-full" title={t('notConfigured.title')} tone="info">
          {t('notConfigured.body')}
        </Alert>
      ) : null}
    </div>
  )
}

function VoicePanelBody({
  hint,
  onSubmit,
  isPending,
  error,
  disabledReason = null,
  children,
  usedThisMonth,
  monthlyLimit,
}: VoicePanelProps & { usedThisMonth: number; monthlyLimit: number }) {
  const { t, i18n } = useTranslation('voice')
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [language, setLanguage] = useState<SpeechLanguage>(
    i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ',
  )
  const speech = useSpeechRecognition((phrase) => {
    if (phrase !== '') setText((current) => (current === '' ? phrase : `${current} ${phrase}`))
  })

  if (!isOpen) {
    return (
      <div className="flex justify-start">
        <Button onClick={() => setIsOpen(true)} size="sm" variant="ghost">
          <Mic aria-hidden="true" className="size-4" />
          {t('open')}
        </Button>
      </div>
    )
  }

  const isLimitReached = usedThisMonth >= monthlyLimit
  const canSubmit =
    text.trim().length >= MIN_TEXT && !isPending && disabledReason === null && !isLimitReached

  function handleSubmit() {
    if (speech.isListening) speech.stop()
    onSubmit(text.trim())
  }

  const errorMessage = describeError(error, t)
  const speechError = speech.error === null ? null : t(`speechError.${speech.error}`)

  return (
    <section
      aria-label={t('title')}
      className="flex flex-col gap-3 rounded-card border border-border bg-sunken p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles aria-hidden="true" className="size-4 text-accent-text" />
        <h3 className="mr-auto text-callout font-medium text-text">{t('title')}</h3>
        <Select
          aria-label={t('language')}
          className="w-36"
          onValueChange={(value) => {
            if (value === 'uz-UZ' || value === 'ru-RU') setLanguage(value)
          }}
          options={SPEECH_LANGUAGES.map((value) => ({ value, label: t(`languages.${value}`) }))}
          size="sm"
          value={language}
        />
        {speech.isSupported ? (
          <Button
            aria-pressed={speech.isListening}
            disabled={isPending}
            onClick={() => (speech.isListening ? speech.stop() : speech.start(language))}
            size="sm"
            variant={speech.isListening ? 'secondary' : 'primary'}
          >
            {speech.isListening ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-accent motion-safe:animate-pulse"
                />
                {t('stop')}
              </>
            ) : (
              <>
                <Mic aria-hidden="true" className="size-4" />
                {t('start')}
              </>
            )}
          </Button>
        ) : null}
      </div>

      <p className="text-caption text-text-secondary">{hint}</p>

      <div className="flex flex-col gap-1">
        <Textarea
          aria-label={t('textLabel')}
          disabled={isPending}
          onChange={(event) => setText(event.target.value)}
          placeholder={speech.isSupported ? t('placeholder') : t('placeholderNoMic')}
          rows={3}
          value={text}
        />
        {speech.interim === '' ? null : (
          <p aria-live="polite" className="text-caption text-text-tertiary">
            {speech.interim}
          </p>
        )}
      </div>

      {speech.isSupported ? null : (
        <p className="flex items-center gap-2 text-caption text-text-secondary">
          <MicOff aria-hidden="true" className="size-4" />
          {t('unsupported')}
        </p>
      )}
      {speechError === null ? null : <Alert title={speechError} tone="warning" />}
      {errorMessage === null ? null : <Alert title={errorMessage} tone="danger" />}
      {disabledReason === null ? null : <Alert title={disabledReason} tone="info" />}
      {isLimitReached ? <Alert title={t('error.limit')} tone="warning" /> : null}
      {children}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-caption text-text-tertiary">
          {t('usage', { used: usedThisMonth, limit: monthlyLimit })}
        </span>
        <Button
          disabled={isPending || text === ''}
          onClick={() => setText('')}
          size="sm"
          variant="ghost"
        >
          {t('clear')}
        </Button>
        <Button
          disabled={!canSubmit}
          isLoading={isPending}
          onClick={handleSubmit}
          size="sm"
          variant="primary"
        >
          {isPending ? t('filling') : t('fill')}
        </Button>
      </div>
      <p className="text-caption text-text-tertiary">{t('privacy')}</p>
    </section>
  )
}

function describeError(error: unknown, t: (key: string) => string): string | null {
  if (error === null || error === undefined) return null
  if (!(error instanceof ApiError)) return t('error.failed')
  if (error.kind === 'network') return t('error.network')
  if (error.kind === 'rateLimited') return t('error.limit')
  if (error.status === 503) return t('error.unavailable')
  return t('error.failed')
}
