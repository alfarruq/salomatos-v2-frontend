import { useEffect, useRef } from 'react'

/** §13.4. 90 minutes by explicit owner decision (was 12); the screen is still cleared when it fires. */
export const IDLE_TIMEOUT_MS = 90 * 60 * 1000

/** How long before the timeout the user is warned. */
export const IDLE_WARNING_MS = 60 * 1000

/*
 * Passive listeners: an idle timer must never be the reason a scroll janks.
 * `mousemove` is included because a receptionist reading a chart moves the
 * mouse without clicking, and locking under their hand would be wrong.
 */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'mousemove',
  'wheel',
  'touchstart',
  'scroll',
] as const

/** Ignore repeat activity for a second — mousemove fires dozens of times. */
const ACTIVITY_THROTTLE_MS = 1000

export interface UseIdleTimerOptions {
  /** Timeout reached: lock the screen and clear what is on it. */
  onIdle: () => void
  /** Fired `warningMs` before `onIdle`, so the user can say they are still there. */
  onWarning?: () => void
  /** Fired when activity resumes after a warning. */
  onActive?: () => void
  timeoutMs?: number
  warningMs?: number
  /** Off while already locked, or on the login screen. */
  isEnabled?: boolean
}

/**
 * Locks an unattended screen (§13.4).
 *
 * The threat is mundane and constant: a reception desk computer left open with
 * a patient record on it while the person who opened it walks away. That is why
 * the timeout is bounded, and why reaching it clears the
 * cache rather than only dimming the screen.
 */
export function useIdleTimer({
  onIdle,
  onWarning,
  onActive,
  timeoutMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
  isEnabled = true,
}: UseIdleTimerOptions): void {
  // Kept in refs so a changing callback does not tear down the listeners and
  // silently restart the countdown on every render.
  const handlers = useRef({ onIdle, onWarning, onActive })
  handlers.current = { onIdle, onWarning, onActive }

  useEffect(() => {
    if (!isEnabled) return

    let warningTimer: ReturnType<typeof setTimeout>
    let idleTimer: ReturnType<typeof setTimeout>
    let lastActivity = 0
    let hasWarned = false

    const schedule = () => {
      clearTimeout(warningTimer)
      clearTimeout(idleTimer)

      warningTimer = setTimeout(
        () => {
          hasWarned = true
          handlers.current.onWarning?.()
        },
        Math.max(0, timeoutMs - warningMs),
      )

      idleTimer = setTimeout(() => {
        handlers.current.onIdle()
      }, timeoutMs)
    }

    const onActivity = () => {
      const now = Date.now()
      if (now - lastActivity < ACTIVITY_THROTTLE_MS) return
      lastActivity = now

      if (hasWarned) {
        hasWarned = false
        handlers.current.onActive?.()
      }
      schedule()
    }

    schedule()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    return () => {
      clearTimeout(warningTimer)
      clearTimeout(idleTimer)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
    }
  }, [isEnabled, timeoutMs, warningMs])
}
