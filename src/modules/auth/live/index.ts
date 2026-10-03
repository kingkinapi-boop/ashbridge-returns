// The live sign-in slot (ARC-6, ARC-20): exists by name, is off and holds no key. GL1 builds the live side.
export const LIVE_OFF = 'live sign-in is off until go-live'

export function createLiveAuth(): never {
  throw new Error(LIVE_OFF)
}
