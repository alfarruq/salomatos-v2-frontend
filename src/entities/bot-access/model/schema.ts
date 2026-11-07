import * as v from 'valibot'
import type { BotAccess } from './types'

/**
 * The wire contract of `apps/bot` on the backend:
 *
 *   GET  /api/v1/patients/{id}/bot-access/          a patient's Telegram login
 *   POST /api/v1/patients/{id}/bot-access/reset/    a new password, chat signed out
 *   GET  /api/v1/staff/{id}/bot-access/             a doctor's or owner's login
 *   POST /api/v1/staff/{id}/bot-access/reset/
 *   GET  /api/v1/me/bot-access/                     the caller's own login (404 for admins)
 */
export const botAccessSchema = v.object({
  login: v.string(),
  // Null when the server can no longer decrypt it; a reset issues a new one.
  password: v.nullable(v.string()),
  linked: v.boolean(),
})

export function toBotAccess(raw: v.InferOutput<typeof botAccessSchema>): BotAccess {
  return { login: raw.login, password: raw.password, isLinked: raw.linked }
}
