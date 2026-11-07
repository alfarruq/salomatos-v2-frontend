import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * The Web Speech API is not in TypeScript's DOM lib yet (Chrome ships it
 * prefixed). Only the members used here are declared.
 */
interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: RecognitionAlternative
}
interface RecognitionEvent {
  readonly resultIndex: number
  readonly results: { readonly length: number; [index: number]: RecognitionResult }
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | null {
  const scope = globalThis as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

export type SpeechError = 'denied' | 'no-speech' | 'network' | 'other'

function toSpeechError(code: string): SpeechError {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied'
  if (code === 'no-speech') return 'no-speech'
  if (code === 'network') return 'network'
  return 'other'
}

export interface SpeechRecognitionControls {
  isSupported: boolean
  isListening: boolean
  /** Words heard but not settled yet; shown greyed, never sent. */
  interim: string
  error: SpeechError | null
  start: (lang: string) => void
  stop: () => void
}

/**
 * Dictation through the browser's own recognizer. `onFinal` receives each
 * settled phrase. The text stays in memory: it is PHI, so it is never logged
 * or persisted here.
 */
export function useSpeechRecognition(onFinal: (text: string) => void): SpeechRecognitionControls {
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<SpeechError | null>(null)
  const recognitionRef = useRef<Recognition | null>(null)
  // The latest callback without restarting the recognizer when it changes.
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const isSupported = recognitionConstructor() !== null

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback((lang: string) => {
    const Constructor = recognitionConstructor()
    if (Constructor === null) return
    recognitionRef.current?.abort()

    const recognition = new Constructor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let pending = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result?.[0]?.transcript ?? ''
        if (result?.isFinal) onFinalRef.current(text.trim())
        else pending += text
      }
      setInterim(pending)
    }
    recognition.onerror = (event) => {
      // "aborted" is our own stop, not a failure worth showing.
      if (event.error !== 'aborted') setError(toSpeechError(event.error))
    }
    recognition.onend = () => {
      setIsListening(false)
      setInterim('')
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setError(null)
    setIsListening(true)
    recognition.start()
  }, [])

  // A closed dialog must not keep the microphone open.
  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { isSupported, isListening, interim, error, start, stop }
}
