import { randomBytes } from 'node:crypto'
import { hashToken } from '../server/analysis/auth.js'

const id = process.argv[2] ?? 'codex'
const days = Number(process.argv[3] ?? 90)
if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || !Number.isInteger(days) || days < 1 || days > 365) {
  throw new Error('Usage: npm run analysis:token -- <client-id> <valid-days:1-365>')
}
const token = randomBytes(32).toString('base64url')
console.info(JSON.stringify({
  token,
  server_client: { id, token_sha256: hashToken(token), expires_at: new Date(Date.now() + days * 86_400_000).toISOString() },
}, null, 2))
