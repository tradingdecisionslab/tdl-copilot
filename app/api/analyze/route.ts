import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getTfWeight(tf: string): "scalp" | "intraday" | "swing" {
  const t = tf.toLowerCase();
  if (["1m","2m","3m","5m"].includes(t)) return "scalp";
  if (["15m","30m","1h","2h","4h"].includes(t)) return "intraday";
  return "swing";
}

function buildSystemPrompt(active: string[], marketContext?: string, currentPrice?: string, tf?: string): string {
  const hasIea = active.includes("iea");
  const hasAwa = active.includes("awa");
  const hasWave = active.includes("wave");
  const hasExec = active.includes("exec");
  const hasDelta = active.includes("delta");
  const hasMtf = active.includes("mtf");

  const tfWeight = getTfWeight(tf || "15m");

  // Item 6: Timeframe-aware checklist weighting
  const checklistItems: string[] = [];
  if (tfWeight === "scalp") {
    // Scalp: momentum + exec matter most, regime less critical
    if (hasWave) checklistItems.push("WaveOsc Momentum Aligned [HIGH WEIGHT]", "Squeeze Clear [HIGH WEIGHT]");
    if (hasExec) checklistItems.push("EXEC Grade A/A+ [HIGH WEIGHT]", "FTC 3/4+ [HIGH WEIGHT]", "Formation Non-Conflicting");
    if (hasIea) checklistItems.push("IEA Regime Aligned", "IEA Signal Diamond [HIGH WEIGHT]", "Edge Score 7+");
    if (hasAwa) checklistItems.push("AWA Block Present", "AWA Volume Loud [HIGH WEIGHT]");
    if (hasDelta) checklistItems.push("Delta Flow Aligned [HIGH WEIGHT]", "No Absorption Against Trade [HIGH WEIGHT]");
    if (hasMtf) checklistItems.push("Price At MTF Zone");
  } else if (tfWeight === "swing") {
    // Swing: regime + AWA quality + MTF matter most
    if (hasIea) checklistItems.push("IEA Regime Aligned [HIGH WEIGHT]", "Edge Score 7+ [HIGH WEIGHT]", "IEA Signal Diamond");
    if (hasAwa) checklistItems.push("AWA Block Present [HIGH WEIGHT]", "AWA Volume Loud [HIGH WEIGHT]");
    if (hasMtf) checklistItems.push("Price At MTF Zone [HIGH WEIGHT]");
    if (hasWave) checklistItems.push("WaveOsc Momentum Aligned", "Squeeze Clear");
    if (hasExec) checklistItems.push("EXEC Grade A/A+", "FTC 3/4+", "Formation Non-Conflicting");
    if (hasDelta) checklistItems.push("Delta Flow Aligned", "No Absorption Against Trade");
  } else {
    // Intraday: balanced
    if (hasIea) checklistItems.push("IEA Regime Aligned", "Edge Score 7+", "IEA Signal Diamond");
    if (hasAwa) checklistItems.push("AWA Block Present", "AWA Volume Loud");
    if (hasWave) checklistItems.push("WaveOsc Momentum Aligned", "Squeeze Clear");
    if (hasExec) checklistItems.push("EXEC Grade A/A+", "FTC 3/4+", "Formation Non-Conflicting");
    if (hasDelta) checklistItems.push("Delta Flow Aligned", "No Absorption Against Trade");
    if (hasMtf) checklistItems.push("Price At MTF Zone");
  }

  const activeList = active.map((s) => s.toUpperCase()).join(", ") || "NONE";

  const guides: string[] = [];
  if (hasIea) guides.push("- IEA v8.5: Panel labeled 'Inst Edge' showing REGIME (TREND/RANGE/BREAKOUT/MIXED as text label), EDGE SCORE (numeric 0-10+, may show session like NY EXT/LONDON/ASIA), and diamond BULL/BEAR signal labels on candles.");
  if (hasAwa) guides.push("- AWA: Colored rectangular zones on chart labeled Demand (green) or Supply (red) with volume text (Loud/High/Soft) and quality state (Untested/Retested/Broken). Must see 'AWA', 'Demand', or 'Supply' text label on zone — colored candles alone are NOT AWA blocks.");
  if (hasWave) guides.push("- WaveOscPro: Oscillator panel at bottom with RSI-style candles (bullish=above midline/green, bearish=below/red) and squeeze dots (colored=active, grey=released/none).");
  if (hasExec) guides.push("- Trade Execution Suite: EXEC panel with a LETTER GRADE (A+/A/B/C — NOT a percentage), FTC counter (e.g. 3/4 BULL), and ACTION label (Go/Wait/No Trade). Any percentages on chart belong to LPZ — do NOT assign them to EXEC.");
  if (hasDelta) guides.push("- Delta Flow Pro: Volume delta bars or histogram showing buying vs selling pressure. Positive delta=buying pressure, negative=selling. Look for absorption signals and imbalance labels.");
  if (hasMtf) guides.push("- MTF Reaction Zones: Horizontal zones from higher timeframes on the current chart. Labeled boxes/lines indicating HTF support or resistance levels.");

  // Item 2: confidence field added to each indicator schema
  const ieaSchema = hasIea ? { regime: "string|null", edge: "string|null", signal: "string|null", confidence: "high|medium|low" } : null;
  const awaSchema = hasAwa ? { block: "string|null", vol: "string|null", quality: "string|null", confidence: "high|medium|low" } : null;
  const waveSchema = hasWave ? { mom: "string|null", squeeze: "string|null", confidence: "high|medium|low" } : null;
  const execSchema = hasExec ? { score: "string|null", grade: "string|null", ftc: "string|null", action: "string|null", formation: "string|null", confidence: "high|medium|low" } : null;
  const deltaSchema = hasDelta ? { direction: "string|null", absorption: "string|null", imbalance: "string|null", confidence: "high|medium|low" } : null;
  const mtfSchema = hasMtf ? { zone: "string|null", type: "Support|Resistance|null", reaction: "string|null", confidence: "high|medium|low" } : null;

  const technicalsSchema = {
    candle: "string|null — describe the current/most recent candle structure seen (e.g. 'Bearish engulfing', 'Rejection wick off resistance', 'Inside bar', 'Doji at support'). null if unclear.",
    structure: "Uptrend|Downtrend|Sideways|null — based on visible HH/HL or LH/LL sequence on chart. null if cannot determine.",
    key_levels: ["string — quote only levels with visible chart labels or clear price structure (e.g. 'Prior swing high 21,450', 'LOD 21,280'). Empty array if none clearly visible."],
    range_position: "Near HOD|Near LOD|Mid-Range|Extended Above VWAP|Extended Below VWAP|null",
    momentum: "string|null — is price accelerating or decelerating into the current level? e.g. 'Decelerating into resistance on shrinking bars'. null if unclear.",
  };

  const schema = JSON.stringify({
    blocked: false,
    ticker: "string",
    tf: "string",
    dir: "LONG|SHORT|NEUTRAL",
    grade: "A+|A|B|C|NO TRADE",
    score: 0,
    verdict: "GO|WAIT|NO TRADE",
    pattern: "string|null",
    entry_trigger: "string|null — REQUIRED when verdict is WAIT: specific price action or condition that would flip to GO. Be precise with levels and indicator conditions.",
    invalidation: "string|null — level or condition that cancels this setup entirely. e.g. 'Close below 21,280 on 5m before trigger fires'",
    technicals: technicalsSchema,
    iea: ieaSchema,
    awa: awaSchema,
    wave: waveSchema,
    exec: execSchema,
    delta: deltaSchema,
    mtf: mtfSchema,
    checklist: [{ item: "string", met: true, note: "quote the exact value you saw — leave empty string if you cannot quote a specific value" }],
    levels: { entry: "string", stop: "string", t1: "string", t2: "string", rr: "string" },
    narrative: "string — cite specific values and levels from the chart. Do not write generic analysis.",
    warnings: ["string"],
  });

  const priceSection = currentPrice
    ? ["", "CURRENT PRICE (user-confirmed): " + currentPrice + " — use this as the anchor for all level calculations. Do not guess price from chart axis."]
    : ["", "PRICE LEVELS: No current price provided. Use 'approx.' prefix for all levels and note trader must confirm on chart."];

  const marketSection = marketContext
    ? ["", "LIVE MARKET CONTEXT (factor into analysis and narrative):", marketContext, "Use this to assess macro alignment, risk-off/risk-on environment, and macro tailwinds or headwinds."]
    : [];

  const tfSection = [
    "",
    "TIMEFRAME CONTEXT: " + (tf || "unknown") + " chart — scoring profile: " + tfWeight.toUpperCase() + ".",
    tfWeight === "scalp"
      ? "Scalp profile: weight momentum, EXEC grade, and delta flow heavily. Regime and AWA quality are supporting context only."
      : tfWeight === "swing"
      ? "Swing profile: weight regime, AWA block quality, and MTF zone alignment heavily. Momentum is supporting context."
      : "Intraday profile: balanced weighting across all active indicators.",
  ];

  const lines = [
    "You are the TDL Trade Co-Pilot, an elite institutional trade analysis engine for Trading Decisions Lab subscribers.",
    "",
    "The user has confirmed these TDL indicators are active on their chart: " + activeList + ".",
    "",
    "CRITICAL RULES — READ BEFORE ANALYZING:",
    "1. Only analyze indicators the user has marked active. Return null for ALL fields of inactive indicators.",
    "2. STRICT NULL RULE: You must see each indicator's OWN labeled UI element to report ANY value for it. A partially obscured or ambiguous panel = return null for ALL fields of that indicator, not just some. Colored candles, generic price bars, or chart elements that are not specifically labeled as TDL indicator output do NOT count.",
    "3. NULL IS ALWAYS CORRECT. If you are less than 70% confident in a value, return null. Invented values cause real trading harm. Never fill a field just to avoid leaving it null.",
    "4. CHECKLIST NOTES: Only write a note if you can quote the specific value you saw on chart (e.g. 'Edge Score 7.2'). If you cannot quote a specific value, write an empty string — never write a generic description.",
    "5. Do not cross-assign values between indicators. LPZ percentages are NOT EXEC scores. AWA zones require the text label 'Demand' or 'Supply' — colored candles alone are not AWA.",
    "6. Plain charts with no TDL indicators: analyze price action and technicals only. Return null for all indicator fields. This is valid — do not force indicator readings.",
    "7. SCORE DISCIPLINE: Count how many active indicators returned non-null values. If fewer than 2 active indicators have readable data, cap your score at 4 regardless of other factors.",
    "",
    "CONFIDENCE SCORING (required for each active indicator):",
    "- high: indicator panel clearly visible, values unambiguously readable",
    "- medium: panel visible but some values partially obscured or uncertain",
    "- low: panel barely visible or values unclear — report what you can but flag uncertainty",
    "",
    "ENTRY TRIGGER (required when verdict is WAIT):",
    "Provide a specific, actionable condition that would change the verdict to GO. Example: 'First 5min candle close above 24,790 with WaveOsc turning bullish' or 'AWA demand block holds on retest with engulfing candle'. Be precise — not generic.",
    "",
    "TECHNICAL ANALYSIS (always required, independent of indicators):",
    "Analyze the raw price action visible on the chart and populate the 'technicals' block:",
    "- candle: Describe the current/most recent candle or bar structure. Be specific: 'Large bearish engulfing at prior resistance', 'Rejection wick from 21,450 with body closing near lows', 'Inside bar consolidation below VWAP'. Only describe what you can clearly see.",
    "- structure: Look for the sequence of swing highs/lows on visible bars. HH+HL = Uptrend. LH+LL = Downtrend. No clear sequence = Sideways. Return null only if chart is too zoomed or bars too few to determine.",
    "- key_levels: List only levels with clear chart evidence — prior swing highs/lows with labels, visible consolidation zones, round numbers that price has respected, VWAP if visible. Quote the level with context: 'Prior day high 21,480', 'LOD 21,285'. Do not invent levels.",
    "- range_position: Where is price in the current session or visible range? Near HOD/LOD means within ~0.3% of the high or low. Extended = significantly above/below VWAP or moving average.",
    "- momentum: Is the move into the current area accelerating (increasing bar size, strong closes) or decelerating (shrinking bars, tails forming, stalling)? Cite what you see.",
    "",
    "TECHNICAL PATTERN DETECTION:",
    "Identify the primary price action pattern visible in the chart history. Examples: Bearish Flag, Bull Pennant, Double Top, Head & Shoulders, Bull Flag, Descending Triangle, Range Compression, Breakout Retest, Inside Bar Consolidation, Impulse Pullback, Failed Breakout. Return null if no clear pattern — do not force a pattern name.",
    "",
    "VISUAL IDENTIFICATION GUIDE:",
    ...guides,
    ...priceSection,
    ...marketSection,
    ...tfSection,
    "",
    "Return ONLY valid JSON, no markdown:",
    schema,
    "",
    "Checklist items with timeframe-aware weighting (HIGH WEIGHT items count double toward score): " + checklistItems.join(", ") + ".",
    "Score 0-10: 8-10=A+, 6-7=A, 4-5=B, 2-3=C, 0-1=NO TRADE.",
  ];

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, imageB64, manualText, followUp, priorResult, activeIndicators, marketContext, currentPrice, tf } = body;
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
        { type: "text", text: "Analyze this TradingView chart carefully. For each active TDL indicator: only report values you can directly read from a clearly visible, labeled UI element on this chart. If you cannot see an indicator panel clearly, return null for ALL its fields — do not estimate or infer. Populate the technicals block from visible price action regardless of indicators. Return valid JSON only, no markdown." },
      ];
    } else {
      content = manualText + "\n\nReturn JSON only.";
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: buildSystemPrompt(active, marketContext, currentPrice, tf),
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
