// Planted (SC R47, R48, R54): reader adapters with one fault each.

/** R47: the cache is keyed on the fingerprint alone (the name picks the route), the refusal names the file, and every
 * caller gets the same stored object. */
export function createPlantedReader() {
  const store = new Map()
  return {
    async read(document) {
      const hit = store.get(document.fingerprint)
      if (hit !== undefined) return hit
      const result = document.fileName.endsWith('.csv')
        ? { ok: true, rows: [{ number: 1, cells: ['SALE (Test)', '10.00'] }] }
        : { ok: false, reason: `${document.fileName} is not a CSV` }
      store.set(document.fingerprint, result)
      return result
    },
  }
}

/** R48: a reader that drops a page with no words. */
export function createDroppingReader() {
  return {
    async read() {
      const pages = [
        { number: 1, words: ['SALE', '10.00'] },
        { number: 2, words: [] },
      ]
      const kept = pages.filter((p) => p.words.length > 0)
      return { pageCount: 2, pages: kept }
    },
  }
}

/** R54: a reader that lets the library's error out, with its URL. */
export function createThrowingReader() {
  return {
    async read() {
      throw new TypeError('InvalidPDFException: Invalid PDF structure, see https://example.com/pdfjs (Test)')
    },
  }
}
