export interface BotAccess {
  login: string
  password: string | null
  /** A Telegram chat is signed in with this login right now. */
  isLinked: boolean
}

/** Whose login: a patient's, a staff member's, or the caller's own. */
export type BotAccessTarget =
  | { kind: 'patient'; id: string }
  | { kind: 'staff'; id: string }
  | { kind: 'mine' }
