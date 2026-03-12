import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const INDICATOR_PROMPTS: Record<string, string> = {
  iea: `IEA v8.5: Look for the "Inst Edge" panel (top right). Shows Regime (TREND/RANGE/BREAKOUT/MIXED), session label (NY/ASIA/LONDON + EXT/REG), Order Flow percentage, Volatility state, stats. Diamond signals appear ON candles labeled "BUY+" or "BEAR+". Edge Score is the numeric value 0-10+ in the panel. ONLY report values you can clearly READ as text.`,
  awa: `AWA: Colored rectangular zones on chart (green=demand, red=supply). Labels show volume: "Loud", "High", or "Soft". Quality: Untested/Retested/Broken. ONLY report what you can clearly see.`,
  wave: `WaveOscPro: Oscillator panel below price with colored RSI candles and squeeze dots. Green candles above zero = Bullish, red below = Bearish. Yellow/orange dots = squeeze active. ONLY report what you can clearly see.`,
  exec: `Trade Execution Suite: Look for EXEC panel with letter grade (A+/A/B/C). FTC shows as fraction "3/4 BULL". Action = GO/WAIT/NO TRADE. ONLY report if EXEC panel is explicitly visible with a letter grade. If no EXEC panel visible, return null for all exec fields.`,
  form: `Formation Scanner: Text labels on candles: ABW, DBW, CFB, Inside Bar, 2U, 2D, 3U, 3D. ONLY report formations you can explicitly read.`,
  lpz: `LPZ: Horizontal probability zone lines with percentage labels (e.g. "27% OB", "88%"). Do NOT confuse LPZ percentages with EXEC scores.`,
  macro: `Macro Compass: Separate panel showing macro regime or sector rotation indicators.`,
  hma: `HMA Concavity Pro: Hull Moving Average line changing color based on slope concavity.`,
};

function buildSystemPrompt(indicators: string[]): string {
  const active = indicators.length > 0 ? indicators : ["iea","awa","wave"];
  const indDesc = active.map(id => INDICATOR_PROMPTS[id] || "").filter(Boolean).join(" ");

  const checklistItems: string[] = [];
  if (active.includes("iea")) checklistItems.push("IEA Regime aligned with direction","IEA Edge Score strong and visible","IEA Diamond signal present in direction");
  if (active.includes("awa")) checklistItems.push("AWA Block present and aligned","AWA Volume is Loud or High");
  if (active.includes("wave")) checklistItems.push("WaveOsc Momentum aligned","Squeeze state favorable");
  if (active.includes("exec")) checklistItems.push("EXEC Grade A or better","FTC 3/4 or better");
  if (active.includes("form")) checklistItems.push("Formation non-conflicting");

  return `You are the TDL Trade Co-Pilot, an institutional trade analysis engine for Trading Decisions Lab subscribers.

ACTIVE INDICATORS ON THIS CHART: ${active.join(", ")}

CRITICAL RULES:
1. ONLY analyze these active indicators: ${active.join(", ")}. Set all other indicator fields to null.
2. ONLY report values you can explicitly READ as visible text on the chart. Return null for anything unclear or not visible — NEVER guess or infer.
3. Visual guides for active indicators: ${indDesc}
4. IMPORTANT: LPZ percentage labels (e.g. "88%", "27% OB") are NOT EXEC scores. Edge Score is 0-10+ numeric. EXEC grade is a letter A+/A/B/C only visible if EXEC panel exists.

For image uploads: verify at least one active TDL indicator signature is visible. If none found return: {"blocked":true,"msg":"TDL indicators not detected. Ensure your selected indicators are active and visible on your chart."}

Return ONLY valid JSON, no markdown:
{"blocked":false,"ticker":"string","tf":"string","dir":"LONG|SHORT|NEUTRAL","grade":"A+|A|B|C|NO TRADE","score":0,"verdict":"GO|WAIT|NO TRADE","iea":${active.includes("iea")?"{"regime":"string|null","edge":"string|null","signal":"string|null"}":"null"},"awa":${active.includes("awa")?"{"block":"string|null","vol":"string|null","quality":"string|null"}":"null"},"wave":${active.includes("wave")?"{"mom":"string|null","squeeze":"string|null"}":"null"},"exec":${active.includes("exec")?"{"score":"string|null","grade":"string|null","ftc":"string|null","action":"string|null","formation":"string|null"}":"null"},"checklist":[{"item":"string","met":true,"note":"string"}],"levels":{"entry":"string","stop":"string","t1":"string","t2":"string","rr":"string"},"narrative":"string","warnings":["string"]}

Evaluate checklist items for active indicators: ${checklistItems.join(", ")}. Score 0-10: 8-10=A+, 6-7=A, 4-5=B, 2-3=C, 0-1=NO TRADE.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, imageB64, manualText, followUp, priorResult, indicators = [] } = body;

  try {
    if (followUp && priorResult) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: "You are the TDL Trade Co-Pilot. Answer follow-up trading questions concisely based on prior analysis. Be direct and institutional. Plain text only, no markdown or asterisks.",
        messages: [{ role: "user", content: `Prior analysis: ${JSON.stringify(priorResult)}\n\nQuestion: ${followUp}` }],
      });
      const text = response.content.find(b => b.type === "text")?.text ?? "";
      return NextResponse.json({ answer: text });
    }

    const systemPrompt = buildSystemPrompt(indicators);
    let content: Anthropic.MessageParam["content"];

    if (type === "image" && imageB64) {
      content = [
        { type: "image", source: { type: "base64", media_type: "image/png", data: imageB64 } },
        { type: "text", text: `Analyze this TradingView chart. Active indicators: ${indicators.join(", ")}. Return JSON only.` }
      ];
    } else {
      content = `${manualText}\n\nActive indicators: ${indicators.join(", ")}. Return JSON only.`;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    });

    const raw = response.content.find(b => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);

  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
