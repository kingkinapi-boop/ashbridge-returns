// @mutate
// Finds an object key written twice in one JSON text, which JSON.parse would silently resolve last-wins (W00c RC5).

/** The open object or array while the text is walked: an object remembers its keys and whether the next string is one. */
type Frame = { object: boolean; seen: Set<string>; wantKey: boolean }

/** Index of the quote that closes the string opening at `from`; a backslash takes the next character with it. */
function stringEnd(text: string, from: number): number {
  let i = from + 1
  while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
  return i
}

/** The text of a key after its JSON escapes are decoded, so "a" and "a" are the same key. */
function decoded(raw: string): string {
  try {
    return JSON.parse(raw) as string
  } catch {
    return raw
  }
}

/** Every key of every object of the text, in the order written, once per occurrence, with the keys already seen in that same object. */
function scanKeys(text: string, onKey: (key: string, seenInObject: boolean) => void): void {
  const stack: Frame[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const top = stack[stack.length - 1]
    if (ch === '"') {
      const end = stringEnd(text, i)
      if (top !== undefined && top.object && top.wantKey) {
        const key = decoded(text.slice(i, end + 1))
        onKey(key, top.seen.has(key))
        top.seen.add(key)
        top.wantKey = false
      }
      i = end + 1
    } else {
      if (ch === '{' || ch === '[') stack.push({ object: ch === '{', seen: new Set(), wantKey: ch === '{' })
      else if (ch === '}' || ch === ']') stack.pop()
      else if (ch === ',' && top !== undefined && top.object) top.wantKey = true
      i++
    }
  }
}

/** Every key that appears twice in any one object of the text, once per repeat, in the order the repeat shows. Equal keys in different objects and text inside string values are not repeats. */
export function repeatedKeys(text: string): readonly { key: string }[] {
  const found: { key: string }[] = []
  scanKeys(text, (key, seen) => {
    if (seen) found.push({ key })
  })
  return found
}

/** The prototype names: a key spelt so is dropped by z.record or reaches the prototype of the parsed object (W00c RC-A). */
const RESERVED = new Set(['__proto__', 'constructor', 'prototype'])

/** Every key of any object, at any depth, that is a prototype name once its JSON escapes are decoded, once per occurrence, in the order written. */
export function reservedKeys(text: string): readonly { key: string }[] {
  const found: { key: string }[] = []
  scanKeys(text, (key) => {
    if (RESERVED.has(key)) found.push({ key })
  })
  return found
}
