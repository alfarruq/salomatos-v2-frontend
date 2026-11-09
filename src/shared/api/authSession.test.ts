import { afterEach, describe, expect, it } from 'vitest'
import { storage } from '@/shared/lib/storage'
import { clearSession, restoreSession, saveSession } from './authSession'
import { getAccessToken } from './tokenStore'

function tokenExpiringIn(seconds: number): string {
  const encode = (value: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value))
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const exp = Date.now() / 1000 + seconds
  return `${encode({ alg: 'HS256' })}.${encode({ user_id: 1, exp })}.signature`
}

afterEach(() => {
  clearSession()
})

describe('saveSession', () => {
  it('puts the access token in memory and both tokens in storage', () => {
    const access = tokenExpiringIn(3600)
    saveSession(access, 'a-refresh-token')

    expect(getAccessToken()).toBe(access)
    expect(storage.get('accessToken')).toBe(access)
    expect(storage.get('refreshToken')).toBe('a-refresh-token')
  })
})

describe('clearSession', () => {
  it('drops both tokens from memory and storage', () => {
    saveSession(tokenExpiringIn(3600), 'a-refresh-token')

    clearSession()

    expect(getAccessToken()).toBeNull()
    expect(storage.get('accessToken')).toBeNull()
    expect(storage.get('refreshToken')).toBeNull()
  })
})

describe('restoreSession', () => {
  it('loads a live token from storage into memory', () => {
    const access = tokenExpiringIn(3600)
    storage.set('accessToken', access)

    expect(restoreSession()).toBe(true)
    expect(getAccessToken()).toBe(access)
  })

  it('clears both tokens and returns false when there is nothing stored', () => {
    expect(restoreSession()).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('clears both tokens for an expired token with an unusable refresh token', () => {
    storage.set('accessToken', tokenExpiringIn(-3600))
    storage.set('refreshToken', 'a-refresh-token')

    expect(restoreSession()).toBe(false)
    expect(getAccessToken()).toBeNull()
    expect(storage.get('accessToken')).toBeNull()
    expect(storage.get('refreshToken')).toBeNull()
  })

  it('keeps a live refresh token so the first request can trade it', () => {
    const refresh = tokenExpiringIn(86_400)
    storage.set('accessToken', tokenExpiringIn(-3600))
    storage.set('refreshToken', refresh)

    expect(restoreSession()).toBe(false)
    expect(getAccessToken()).toBeNull()
    expect(storage.get('accessToken')).toBeNull()
    expect(storage.get('refreshToken')).toBe(refresh)
  })
})
