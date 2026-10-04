// SC10 R87 plant: an R82 set that takes every file the Spec section names, with no expectation class and no Build check.
import { sectionNames } from '../../../lib.mjs'

export function specOwnedFiles(cardText, files) {
  const spec = sectionNames(cardText, 'Spec')
  return files.filter((f) => spec.some((n) => f === n || f.endsWith(`/${n}`)))
}
