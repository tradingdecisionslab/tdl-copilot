import { NextResponse } from "next/server";

const SYMBOLS = [
  { ticker: "NQ=F",  label: "NQ"  },
  { ticker: "QQQ",   label: "QQQ" },
  { ticker: "SPY",   label: "SPY" },
  { ticker: "%5EVIX", label: "VIX" },
];

async function fetchQuote(ticker: string) {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + ticker + "?interval=1m&range=1d";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = meta.regularMarketPrice ?? null;
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? null;
  const change = price && prev ? ((price - prev) / prev) * 100 : null;
  return { price, change };
}

export async function GET() {
  try {
    const results = await Promise.allSettled(SYMBOLS.map((s) => fetchQuote(s.ticker)));
    const quotes = SYMBOLS.map((s, i) => {
      const r = results[i];
      const q = r.status === "fulfilled" ? r.value : null;
      return {
        label: s.label,
        price: q?.price ?? null,
        change: q?.change ?? null,
      };
    });
    return NextResponse.json({ quotes, ts: Date.now() });
  } catch {
    return NextResponse.json({ quotes: [], ts: Date.now() });
  }
}
