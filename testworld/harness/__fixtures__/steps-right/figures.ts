// A stub step for the JH0 acceptance tests: returns exactly the figures the test world expects for the client.
export default {
  run(ctx: { client: { trialBalance: { adjusted: { rows: { account: string; debitCents: number; creditCents: number }[] } } } }) {
    const figures: Record<string, number> = {}
    for (const r of ctx.client.trialBalance.adjusted.rows) figures[`tb.adjusted.${r.account}`] = r.debitCents - r.creditCents
    return { figures }
  },
}
