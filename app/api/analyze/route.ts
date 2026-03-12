import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(active: string[], marketContext?: string): string {
  const hasIea = active.includes("iea");
  const hasAwa = active.includes("awa");
  const hasWave = active.includes("wave");
  const hasExec = active.includes("exec");
  const hasDelta = active.includes("delta");
  const hasMtf = active.includes("mtf");

  const checklistItems: string[] = [];
  if (hasIea) checklistItems.push("IEA Regime Aligned", "Edge Score 7+", "IEA Signal Diamond");
  if (hasAwa) checklistItems.push("AWA Block Present", "AWA Volume Loud");
  if (hasWave) checklistItems.push("WaveOsc Momentum Aligned", "Squeeze Clear");
  if (hasExec) checklistItems.push("EXEC Grade A/A+", "FTC 3/4+", "Formation Non-Conflicting");
  if (hasDelta) checklistItems.push("Delta Flow Aligned", "No Absorption Against Trade");
  if (hasMtf) checklistItems.push("Price At MTF Zone");

  const activeList = active.map((s) => s.toUpperCase()).join(", ") || "NONE";

  const guides: string[] = [];
  if (hasIea) guides.push("- IEA v8.5: Panel labeled 'Inst Edge' showing REGIME (TREND/RANGE/BREAKOUT/MIXED as text label), EDGE SCORE (numeric 0-10+, may show session like NY EXT/LONDON/ASIA), and diamond BULL/BEAR signal labels on candles.");
  if (hasAwa) guides.push("- AWA: Colored rectangular zones on chart labeled Demand (green) or Supply (red) with volume text (Loud/High/Soft) and quality state (Untested/Retested/Broken).");
  if (hasWave) guides.push("- WaveOscPro: Oscillator panel at bottom with RSI-style candles (bullish=above midline/green, bearish=below/red) and squeeze dots (colored=active, grey=released/none).");
  if (hasExec) guides.push("- Trade Execution Suite: EXEC panel with a LETTER GRADE (A+/A/B/C — NOT a percentage), FTC counter (e.g. 3/4 BULL), and ACTION label (Go/Wait/No Trade). IMPORTANT: Any percentages on chart belong to LPZ — do NOT assign them to EXEC.");
  if (hasDelta) guides.push("- Delta Flow Pro: Volume delta bars or histogram showing buying vs selling pressure. Positive delta=buying pressure, negative=selling. Look for absorption signals and imbalance labels.");
  if (hasMtf) guides.push("- MTF Reaction Zones: Horizontal zones from higher timeframes on the current chart. Labeled boxes/lines indicating HTF support or resistance levels.");

  const schema = JSON.stringify({
    blocked: false,
    ticker: "string",
    tf: "string",
    dir: "LONG|SHORT|NEUTRAL",
    grade: "A+|A|B|C|NO TRADE",
    score: 0,
    verdict: "GO|WAIT|NO TRADE",
    pattern: "string|null",
    iea: hasIea ? { regime: "string|null", edge: "string|null", signal: "string|null" } : null,
    awa: hasAwa ? { block: "string|null", vol: "string|null", quality: "string|null" } : null,
    wave: hasWave ? { mom: "string|null", squeeze: "string|null" } : null,
    exec: hasExec ? { score: "string|null", grade: "string|null", ftc: "string|null", action: "string|null", formation: "string|null" } : null,
    delta: hasDelta ? { direction: "string|null", absorption: "string|null", imbalance: "string|null" } : null,
    mtf: hasMtf ? { zone: "string|null", type: "Support|Resistance|null", reaction: "string|null" } : null,
    checklist: [{ item: "string", met: true, note: "string" }],
    levels: { entry: "string", stop: "string", t1: "string", t2: "string", rr: "string" },
    narrative: "string",
    warnings: ["string"],
  });

  const marketSection = marketContext
    ? [
        "",
        "LIVE MARKET CONTEXT (factor this into your analysis and narrative):",
        marketContext,
        "Use this context to assess macro alignment, risk-off/risk-on environment, and whether the setup has macro tailwinds or headwinds.",
      ]
    : [];

  const lines = [
    "You are the TDL Trade Co-Pilot, an elite institutional trade analysis engine for Trading Decisions Lab subscribers.",
    "",
    "The user has confirmed these TDL indicators are active on their chart: " + activeList + ".",
    "",
    "CRITICAL RULES:",
    "1. Only analyze indicators the user has marked active. Return null for all inactive indicator fields.",
    "2. Never guess, infer, or hallucinate values. If you cannot clearly read a value, return null.",
    "3. Do not assign values from one indicator to another (LPZ percentages are NOT EXEC scores).",
    "4. For price levels in image analysis: provide approximate zones based on visible structure, not exact numbers. Prefix with 'approx.' and note trader should confirm on chart.",
    "",
    "TECHNICAL PATTERN DETECTION:",
    "Identify the primary price action pattern visible on the chart. Examples: Bearish Flag, Bull Pennant, Double Top, Head & Shoulders, Bull Flag, Descending Triangle, Range Compression, Breakout Retest, Inside Bar Consolidation, Impulse Pullback. Return null if no clear pattern.",
    "",
    "VISUAL IDENTIFICATION GUIDE:",
    ...guides,
    ...marketSection,
    "",
    "For image uploads: verify at least one active TDL indicator is visible. If none found return:",
    "{\"blocked\":true,\"msg\":\"TDL indicators not detected. Ensure your selected indicators are active and visible on your chart.\"}",
    "",
    "Return ONLY valid JSON, no markdown:",
    schema,
    "",
    "Checklist items (active indicators only): " + checklistItems.join(", ") + ".",
    "Score 0-10: 8-10=A+, 6-7=A, 4-5=B, 2-3=C, 0-1=NO TRADE.",
  ];

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, imageB64, manualText, followUp, priorResult, activeIndicators, marketContext } = body;
  const active: string[] = activeIndicators ?? ["iea", "awa", "wave"];

  try {
    if (followUp && priorResult) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: "You are the TDL Trade Co-Pilot. Answer follow-up trading questions concisely based on prior analysis. Be direct and institutional. Plain text only — no markdown, no asterisks, no bold, no headers.",
        messages: [{ role: "user", content: "Prior analysis: " + JSON.stringify(priorResult) + "\n\nQuestion: " + followUp }],
      });
      const text = response.content.find((b) => b.type === "text")?.text ?? "";
      return NextResponse.json({ answer: text });
    }

    let content: Anthropic.MessageParam["content"];

    if (type === "image" && imageB64) {
      content = [
        { type: "image", source: { type: "base64", media_type: "image/png", data: imageB64 } },
        { type: "text", text: "Analyze this TradingView chart with TDL indicators. Return JSON only." },
      ];
    } else {
      content = manualText + "\n\nReturn JSON only.";
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: buildSystemPrompt(active, marketContext),
      messages: [{ role: "user", content }],
    });

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
