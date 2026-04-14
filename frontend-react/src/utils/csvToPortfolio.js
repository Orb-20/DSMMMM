import Papa from 'papaparse';

// Parse a user-supplied CSV of stock data into the same shape the dashboard
// already consumes. We tolerate two common layouts:
//   (A) price history:  date, TICKER1, TICKER2, ...   (OHLCV style)
//   (B) weight table :  ticker,weight[,cluster,...]
//
// Returns: { kind: 'prices' | 'weights' | 'unknown', ... }

export function parseCsv(text) {
  const parsed = Papa.parse(text.trim(), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  if (parsed.errors?.length) {
    // Keep first error for surfacing; don't hard-fail since Papa recovers well.
    console.warn('CSV parse warnings:', parsed.errors.slice(0, 3));
  }
  const rows = parsed.data || [];
  const fields = (parsed.meta?.fields || []).map(f => String(f).trim());
  if (!rows.length || !fields.length) {
    return { kind: 'unknown', error: 'Empty CSV' };
  }

  const lower = fields.map(f => f.toLowerCase());

  // Layout B — ticker/weight table
  if (lower.includes('ticker') && lower.includes('weight')) {
    const tIdx = lower.indexOf('ticker');
    const wIdx = lower.indexOf('weight');
    const cIdx = lower.indexOf('cluster');
    const weights = rows
      .filter(r => r[fields[tIdx]] != null && r[fields[wIdx]] != null)
      .map((r, i) => ({
        ticker: String(r[fields[tIdx]]).toUpperCase(),
        weight: Number(r[fields[wIdx]]),
        cluster: cIdx >= 0 ? Number(r[fields[cIdx]]) || 0 : i % 4,
        annual_return: Number(r.annual_return ?? r['annual return'] ?? 0),
        annual_vol:    Number(r.annual_vol    ?? r['annual vol']    ?? 0),
      }))
      .filter(r => !Number.isNaN(r.weight));
    return { kind: 'weights', weights };
  }

  // Layout A — date + ticker columns
  const dateField = fields.find(f => /^(date|timestamp)$/i.test(f));
  if (dateField) {
    const tickers = fields.filter(f => f !== dateField);
    const priceHistory = rows.map(r => {
      const entry = { date: String(r[dateField]) };
      tickers.forEach(t => { entry[t] = Number(r[t]); });
      return entry;
    });
    // Derive simple summary weights via inverse-volatility so the dashboard
    // still has something to visualize without running the Python pipeline.
    const weights = deriveWeightsFromPrices(priceHistory, tickers);
    return { kind: 'prices', tickers, priceHistory, weights };
  }

  return { kind: 'unknown', error: 'Could not detect CSV layout (expected "date" + tickers, or "ticker,weight").' };
}

function deriveWeightsFromPrices(priceHistory, tickers) {
  // log-returns
  const returns = Object.fromEntries(tickers.map(t => [t, []]));
  for (let i = 1; i < priceHistory.length; i++) {
    tickers.forEach(t => {
      const p0 = priceHistory[i - 1][t];
      const p1 = priceHistory[i][t];
      if (p0 > 0 && p1 > 0) returns[t].push(Math.log(p1 / p0));
    });
  }
  const stats = tickers.map(t => {
    const r = returns[t];
    if (!r.length) return { ticker: t, mean: 0, vol: 1 };
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    const v = r.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(r.length - 1, 1);
    return { ticker: t, mean, vol: Math.sqrt(v) || 1e-6 };
  });
  const invVol = stats.map(s => 1 / s.vol);
  const total = invVol.reduce((a, b) => a + b, 0) || 1;
  return stats.map((s, i) => ({
    ticker: s.ticker,
    weight: invVol[i] / total,
    cluster: i % 4,
    annual_return: s.mean * 252,
    annual_vol: s.vol * Math.sqrt(252),
  })).sort((a, b) => b.weight - a.weight);
}
