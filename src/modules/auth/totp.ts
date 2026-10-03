// One-time codes: RFC 6238 over RFC 4226, SHA-1, 30-second steps, six digits (SEC-1).
import { createHmac } from 'node:crypto'

export const STEP_MS = 30_000

export function stepOf(at: Date): number {
  return Math.floor(at.getTime() / STEP_MS)
}

export function totpAtStep(secret: Uint8Array, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac('sha1', secret).update(counter).digest()
  const offset = (mac[19] ?? 0) & 0x0f
  const binary = mac.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 1_000_000).padStart(6, '0')
}

export function totp(secret: Uint8Array, at: Date): string {
  return totpAtStep(secret, stepOf(at))
}
