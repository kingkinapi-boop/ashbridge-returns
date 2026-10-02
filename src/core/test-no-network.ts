// Run-time network guard for every Vitest project (SEC-10): nothing leaves the machine at test time.
// Wraps fetch and net.Socket.prototype.connect; only loopback hosts pass. file: and data: URLs pass.
import net from 'node:net'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

function blocked(host: string): Error {
  return new Error(`network blocked in tests: ${host}`)
}

function isLoopback(host: string): boolean {
  const h = host.toLowerCase()
  return LOOPBACK.has(h) || /^127\.\d+\.\d+\.\d+$/.test(h)
}

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  let url: URL | undefined
  try {
    url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  } catch {
    url = undefined
  }
  if (url !== undefined && url.protocol !== 'file:' && url.protocol !== 'data:' && !isLoopback(url.hostname)) {
    throw blocked(url.hostname)
  }
  return realFetch(input, init)
})

type ConnectArgs = Parameters<net.Socket['connect']>
// eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with the right this below
const realConnect = net.Socket.prototype.connect as (this: net.Socket, ...args: unknown[]) => net.Socket
net.Socket.prototype.connect = function (this: net.Socket, ...args: ConnectArgs): net.Socket {
  const first: unknown = args[0]
  const opts = Array.isArray(first) ? (first[0] as unknown) : first
  let host: string | undefined
  let isPath = false
  if (typeof opts === 'object' && opts !== null) {
    const o = opts as { host?: string; path?: string; port?: unknown }
    if (typeof o.path === 'string') isPath = true
    host = o.host ?? 'localhost'
  } else if (typeof opts === 'number' || (typeof opts === 'string' && /^\d+$/.test(opts))) {
    host = typeof args[1] === 'string' ? args[1] : 'localhost'
  } else {
    isPath = true
  }
  if (!isPath && host !== undefined && !isLoopback(host)) {
    const err = blocked(host)
    process.nextTick(() => this.destroy(err))
    return this
  }
  return realConnect.apply(this, args as unknown[])
} as typeof net.Socket.prototype.connect
