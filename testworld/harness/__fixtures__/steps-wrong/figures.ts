// A stub step for the JH0 acceptance tests: one figure is one cent off.
export default {
  run(ctx: { client: { trialBalance: { adjusted: { rows: { account: string; debitCents: number; creditCents: number }[] } } } }) {
    const figures: Record<string, number> = {}
    for (const r of ctx.client.trialBalance.adjusted.rows) figures[`tb.adjusted.${r.account}`] = r.debitCents - r.creditCents
    const first = Object.keys(figures)[0]
    if (first !== undefined) figures[first] = (figures[first] ?? 0) + 1
    return { figures }
  },
}
