import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient, type Session, type User } from '@supabase/supabase-js'
import { verifySessionAccess } from '../src/lib/session-access'
import { OWNER_EMAIL } from '../src/lib/auth'

const user: User = {
  id: '20000000-0000-4000-8000-000000000001', email: OWNER_EMAIL,
  aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
}
const now = Math.floor(Date.now() / 1000)
function token(exp: number) {
  return [
    { alg: 'HS256', typ: 'JWT' }, { sub: user.id, email: user.email, aud: 'authenticated', exp, iat: now - 7200 },
  ].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).concat('test-signature').join('.')
}
const staleToken = token(now - 3600)
const freshToken = token(now + 3600)

function fixture(options: { rpcStatuses?: number[]; allowed?: boolean; refreshStatus?: number; email?: string; offline?: boolean } = {}) {
  const session: Session = {
    access_token: staleToken, refresh_token: 'test-refresh', token_type: 'bearer',
    // Reproduce a stale JWT whose cached expiry/device clock still looks valid to the SDK.
    expires_at: now + 7200, expires_in: 3600, user: { ...user, email: options.email ?? user.email },
  }
  const storage = new Map([['test-session', JSON.stringify(session)]])
  const requests: { path: string; authorization: string | null }[] = []
  let rpcCount = 0
  const client = createClient('https://test-project.supabase.co', 'sb_publishable_test', {
    auth: {
      storageKey: 'test-session', autoRefreshToken: false, detectSessionInUrl: false,
      storage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value) },
        removeItem: key => { storage.delete(key) },
      },
    },
    global: {
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname
        requests.push({ path, authorization: new Headers(init?.headers).get('authorization') })
        if (options.offline) throw new TypeError('Failed to fetch')
        if (path === '/rest/v1/rpc/shiji_has_access') {
          const status = options.rpcStatuses?.[rpcCount++] ?? 200
          return Response.json(status === 200 ? options.allowed ?? true : {
            code: 'PGRST303', message: 'JWT expired', details: null, hint: null,
          }, { status })
        }
        assert.equal(path, '/auth/v1/token')
        assert.equal(JSON.parse(String(init?.body)).refresh_token, 'test-refresh')
        const status = options.refreshStatus ?? 200
        return Response.json(status === 200 ? {
          access_token: freshToken, refresh_token: 'test-refreshed', expires_in: 3600,
          token_type: 'bearer', user,
        } : { code: status === 429 ? 'over_request_rate_limit' : 'refresh_token_not_found', message: 'Cannot refresh session' }, { status })
      },
    },
  })
  return { client, session, requests }
}

test('server rejection refreshes a stale JWT and rechecks access using the new token', async () => {
  const { client, session, requests } = fixture({ rpcStatuses: [401, 200] })
  assert.equal(await verifySessionAccess(client, session), 'allowed')
  assert.deepEqual(requests.map(r => r.path), ['/rest/v1/rpc/shiji_has_access', '/auth/v1/token', '/rest/v1/rpc/shiji_has_access'])
  assert.equal(requests[0].authorization, `Bearer ${staleToken}`)
  assert.equal(requests[2].authorization, `Bearer ${freshToken}`)
  assert.equal((await client.auth.getSession()).data.session?.access_token, freshToken)
})

test('an invalid refresh token returns to password entry instead of a network retry loop', async () => {
  const { client, session, requests } = fixture({ rpcStatuses: [401], refreshStatus: 400 })
  assert.equal(await verifySessionAccess(client, session), 'denied')
  assert.equal(requests.length, 2)
})

test('refresh throttling preserves a retryable error instead of treating the login as invalid', async () => {
  const { client, session } = fixture({ rpcStatuses: [401], refreshStatus: 429 })
  assert.equal(await verifySessionAccess(client, session), 'error')
  assert.ok((await client.auth.getSession()).data.session)
})

test('network failures leave the saved login available for retry', async () => {
  const { client, session, requests } = fixture({ offline: true })
  assert.equal(await verifySessionAccess(client, session), 'error')
  assert.equal(requests.length, 1)
  assert.ok((await client.auth.getSession()).data.session)
})

test('a refreshed token still requires server authorization', async () => {
  const { client, session } = fixture({ rpcStatuses: [401, 200], allowed: false })
  assert.equal(await verifySessionAccess(client, session), 'denied')
})

test('a second 401 stops after one refresh and requests a new login', async () => {
  const { client, session, requests } = fixture({ rpcStatuses: [401, 401] })
  assert.equal(await verifySessionAccess(client, session), 'denied')
  assert.equal(requests.filter(r => r.path === '/auth/v1/token').length, 1)
})

test('a valid owner session checks access without refreshing', async () => {
  const { client, session, requests } = fixture()
  assert.equal(await verifySessionAccess(client, session), 'allowed')
  assert.equal(requests.length, 1)
})

test('another account cannot enter the app or trigger a refresh', async () => {
  const { client, session, requests } = fixture({ email: 'other@example.com' })
  assert.equal(await verifySessionAccess(client, session), 'denied')
  assert.equal(requests.length, 0)
})
