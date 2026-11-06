import { describe, expect, it } from 'vitest'
import { isJwtExpired, readJwtPayload } from './jwt'

function token(payload: unknown): string {
  const encode = (value: unknown): string => {
    // btoa only takes latin1, so the JSON is UTF-8 encoded first — the same
    // thing a real signer does, and what makes the non-ASCII case meaningful.
    const bytes = new TextEncoder().encode(JSON.stringify(value))
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

describe('readJwtPayload', () => {
  it('reads the claim simplejwt actually emits', () => {
    expect(
      readJwtPayload(
        token({ token_type: 'access', user_id: '7f1c2a8e-0b3d-4c5e-9f61-2a3b4c5d6e7f' }),
      ),
    ).toEqual({
      userId: '7f1c2a8e-0b3d-4c5e-9f61-2a3b4c5d6e7f',
    })
  })

  it('decodes base64url without padding', () => {
    // A payload whose base64 needs padding exercises the `padEnd` branch; a
    // non-ASCII claim exercises the UTF-8 decode.
    const value = token({
      user_id: '7f1c2a8e-0b3d-4c5e-9f61-2a3b4c5d6e7f',
      name: "Dilnoza O'g'li",
      note: 'ы',
    })

    expect(value).not.toContain('=')
    expect(readJwtPayload(value)).toEqual({ userId: '7f1c2a8e-0b3d-4c5e-9f61-2a3b4c5d6e7f' })
  })

  it('returns null rather than throwing on anything unreadable', () => {
    expect(readJwtPayload('')).toBeNull()
    expect(readJwtPayload('not-a-token')).toBeNull()
    // Two segments, not three.
    expect(readJwtPayload('a.b')).toBeNull()
    expect(readJwtPayload('a.!!!not-base64!!!.c')).toBeNull()
  })

  it('refuses a payload without a usable user id', () => {
    expect(readJwtPayload(token({ token_type: 'access' }))).toBeNull()
    expect(readJwtPayload(token(null))).toBeNull()
    // The backend's ids are UUID strings; a number is not one of its tokens.
    expect(readJwtPayload(token({ user_id: 42 }))).toBeNull()
    expect(readJwtPayload(token({ user_id: '' }))).toBeNull()
    expect(readJwtPayload(token({ user_id: '  ' }))).toBeNull()
  })
})

describe('isJwtExpired', () => {
  it('is false for a token whose exp is in the future', () => {
    expect(isJwtExpired(token({ user_id: 1, exp: Date.now() / 1000 + 3600 }))).toBe(false)
  })

  it('is true for a token whose exp is in the past', () => {
    expect(isJwtExpired(token({ user_id: 1, exp: Date.now() / 1000 - 3600 }))).toBe(true)
  })

  it('treats a token expiring within the skew window as expired', () => {
    expect(isJwtExpired(token({ user_id: 1, exp: Date.now() / 1000 + 10 }), 30)).toBe(true)
  })

  it('is true for anything unreadable, same as readJwtPayload returning null', () => {
    expect(isJwtExpired('')).toBe(true)
    expect(isJwtExpired('not-a-token')).toBe(true)
    expect(isJwtExpired(token({ user_id: 1 }))).toBe(true)
  })
})
