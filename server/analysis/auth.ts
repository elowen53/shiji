import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { AnalysisError } from './errors.js'

const clientSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  token_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  expires_at: z.iso.datetime({ offset: true }),
  revoked: z.boolean().default(false),
})
export const clientsSchema = z.array(clientSchema).min(1).max(20).refine(
  (clients) => new Set(clients.map((client) => client.id)).size === clients.length &&
    new Set(clients.map((client) => client.token_sha256)).size === clients.length,
  'Client IDs and token hashes must be unique.',
)
export type AnalysisClient = z.infer<typeof clientSchema>
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function authenticate(header: string | null, clients: AnalysisClient[], now: Date): AnalysisClient {
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]{43,256})$/i)
  if (!match) throw new AnalysisError(401, 'UNAUTHORIZED', 'A valid analysis Bearer token is required.')
  const digest = Buffer.from(hashToken(match[1]), 'hex')
  const client = clients.find((candidate) => timingSafeEqual(digest, Buffer.from(candidate.token_sha256, 'hex')))
  if (!client || client.revoked || Date.parse(client.expires_at) <= now.getTime()) {
    throw new AnalysisError(401, 'UNAUTHORIZED', 'A valid analysis Bearer token is required.')
  }
  return client
}
