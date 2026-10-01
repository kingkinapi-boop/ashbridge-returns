// Page images, made up. Masking is part of the image itself (SEC-4): the black bars hold no text.
import { stmtRows, closingBalance, ROW_Y0, ROW_STEP } from './data.mjs'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const head = (title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612" height="792" role="img" aria-label="${esc(title)}" font-family="Roboto, Arial, sans-serif">
<title>${esc(title)}</title>
<rect width="612" height="792" fill="#ffffff"/>
<rect x="0" y="0" width="612" height="6" fill="#355b7d"/>`
const mask = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000000"/>`

export function statementP2() {
  const rows = stmtRows.map((r, i) => {
    const y = ROW_Y0 + i * ROW_STEP
    return `<text x="40" y="${y}" font-size="11" fill="#222">${r.date}</text>
<text x="96" y="${y}" font-size="11" fill="#222">${esc(r.desc.slice(0, 44))}</text>
<text x="420" y="${y}" font-size="11" fill="#222" text-anchor="end">${r.wd}</text>
<text x="490" y="${y}" font-size="11" fill="#222" text-anchor="end">${r.dep}</text>
<text x="576" y="${y}" font-size="11" fill="#222" text-anchor="end">${r.bal}</text>
<line x1="36" y1="${y + 6}" x2="576" y2="${y + 6}" stroke="#d8dde3" stroke-width="0.6"/>`
  }).join('\n')
  return `${head('Lakeview Bank (Test) chequing statement, December 2025, page 2 of 3. Account number blacked out.')}
<text x="36" y="48" font-size="20" font-weight="700" fill="#355b7d">Lakeview Bank (Test)</text>
<text x="36" y="70" font-size="12" fill="#444">Business chequing statement</text>
<text x="576" y="48" font-size="11" fill="#444" text-anchor="end">Page 2 of 3</text>
<text x="36" y="120" font-size="11" fill="#444">Account holder</text>
<text x="150" y="120" font-size="11" fill="#222">Maple Ridge Consulting Inc. (Test)</text>
<text x="36" y="142" font-size="11" fill="#444">Account number</text>
${mask(150, 131, 120, 15)}
<text x="36" y="164" font-size="11" fill="#444">Statement period</text>
<text x="150" y="164" font-size="11" fill="#222">1 Dec 2025 to 31 Dec 2025</text>
<text x="36" y="236" font-size="11" font-weight="700" fill="#222">Date</text>
<text x="96" y="236" font-size="11" font-weight="700" fill="#222">Description</text>
<text x="420" y="236" font-size="11" font-weight="700" fill="#222" text-anchor="end">Withdrawals</text>
<text x="490" y="236" font-size="11" font-weight="700" fill="#222" text-anchor="end">Deposits</text>
<text x="576" y="236" font-size="11" font-weight="700" fill="#222" text-anchor="end">Balance</text>
<line x1="36" y1="244" x2="576" y2="244" stroke="#222" stroke-width="1"/>
${rows}
<text x="36" y="770" font-size="9" fill="#666">Made-up document for the test world. Not a real statement.</text>
</svg>`
}

export function statementP3() {
  return `${head('Lakeview Bank (Test) chequing statement, December 2025, page 3 of 3, closing balance. Account number blacked out.')}
<text x="36" y="48" font-size="20" font-weight="700" fill="#355b7d">Lakeview Bank (Test)</text>
<text x="36" y="70" font-size="12" fill="#444">Business chequing statement</text>
<text x="576" y="48" font-size="11" fill="#444" text-anchor="end">Page 3 of 3</text>
<text x="36" y="120" font-size="11" fill="#444">Account holder</text>
<text x="150" y="120" font-size="11" fill="#222">Maple Ridge Consulting Inc. (Test)</text>
<text x="36" y="142" font-size="11" fill="#444">Account number</text>
${mask(150, 131, 120, 15)}
<text x="36" y="200" font-size="13" font-weight="700" fill="#222">Account summary</text>
<text x="36" y="246" font-size="12" fill="#222">Closing balance, 31 Dec 2025</text>
<text x="560" y="250" font-size="16" font-weight="700" fill="#222" text-anchor="end">${closingBalance}</text>
<line x1="36" y1="270" x2="576" y2="270" stroke="#d8dde3"/>
<text x="36" y="300" font-size="12" fill="#222">Interest rate on this account</text>
<text x="576" y="300" font-size="12" fill="#222" text-anchor="end">0.00%</text>
<text x="36" y="324" font-size="12" fill="#222">Service charges, December</text>
<text x="576" y="324" font-size="12" fill="#222" text-anchor="end">0.00</text>
<text x="36" y="770" font-size="9" fill="#666">Made-up document for the test world. Not a real statement.</text>
</svg>`
}

export function t5Draft() {
  return `${head('Draft T5 slip for Priya Nair (Test). Social insurance number and date of birth blacked out.')}
<text x="36" y="48" font-size="18" font-weight="700" fill="#355b7d">T5 Statement of Investment Income</text>
<text x="36" y="68" font-size="11" fill="#444">Draft prepared for review. Not filed. Tax year 2025.</text>
<text x="36" y="120" font-size="11" fill="#444">Payer</text>
<text x="150" y="120" font-size="11" fill="#222">Maple Ridge Consulting Inc. (Test)</text>
<text x="36" y="148" font-size="11" fill="#444">Recipient</text>
<text x="150" y="148" font-size="11" fill="#222">Priya Nair (Test)</text>
<text x="36" y="176" font-size="11" fill="#444">Social insurance number</text>
${mask(190, 165, 130, 15)}
<text x="36" y="204" font-size="11" fill="#444">Date of birth</text>
${mask(190, 193, 90, 15)}
<rect x="36" y="440" width="538" height="110" fill="none" stroke="#9aa6b2"/>
<text x="46" y="466" font-size="10" fill="#444">Box 10</text>
<text x="46" y="482" font-size="10" fill="#222">Actual amount of eligible dividends</text>
<text x="300" y="482" font-size="12" fill="#222" text-anchor="end">0.00</text>
<text x="340" y="486" font-size="10" fill="#444">Box 24</text>
<text x="340" y="502" font-size="10" fill="#222">Actual amount of dividends other</text>
<text x="340" y="514" font-size="10" fill="#222">than eligible dividends</text>
<text x="566" y="512" font-size="14" font-weight="700" fill="#222" text-anchor="end">20,000.00</text>
<text x="36" y="770" font-size="9" fill="#666">Made-up document for the test world. Not a real slip.</text>
</svg>`
}
