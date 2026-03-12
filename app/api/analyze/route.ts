import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(active: string[]): string {
  const hasIea = active.includes("iea");
  const hasAwa = active.includes("awa");
  const hasWave = active.includes("wave");
  const hasExec = active.includes("exec");

  const ieaSchema = hasIea
    ? '{"regime":"string|null","edge":"string|null","signal":"string|null"}'
    : "null";
  const awaSchema = hasAwa
    ? '{"block":"string|null","vol":"string|null","quality":"string|null"}'
    : "null";
  const waveSchema = hasWave
    ? '{"mom":"string|null","squeeze":"string|null"}'
    : "null";
  const execSchema = hasExec
    ? '{"score":"string|null","grade":"string|null","ftc":"string|null","action":"string|null","formation":"string|null"}'
    : "null";

  const checklistItems: string[] = [];
  if (hasIea) checklistItems.push("IEA Regime Aligned", "Edge Score 7+", "IEA Signal Diamond");
  if (hasAwa) checklistItems.push("AWA Block Present", "AWA Volume Loud");
  if (hasWave) checklistItems.push("WaveOsc Momentum Aligned", "Squeeze Clear");
  if (hasExec) checklistItems.push("EXEC 80+", "FTC 3/4+", "Formation Non-Conflicting");

  const jsonSchema = `{"blocked":false,"ticker":"string","tf":"string","dir":"LONG|SHORT|NEUTRAL","grade":"A+|A|B|C|NO TRADE","score":0,"verdict":"GO|WAIT|NO TRADE","iea":${ieaSchema},"awa":${awaSchema},"wave":${waveSchema},"exec":${execSchema},"checklist":[{"item":"string","met":true,"note":"string"}],"levels":{"entry":"string","stop":"string","t1":"string","t2":"string","rr":"string"},"narrative":"string","warnings":["string"]}`;

  const activeList = active.join(", ").toUpperCase() || "NONE SPECIFIED";

  return `You are the TDL Trade Co-Pilot. The user has the following TDL indicators active on their chart: ${activeList}.

CRITICAL: Only analyze and score indicators the user has marked as active. Do NOT infer, guess, or hallucinate values for indicators not in the active list. Return null for any inactive indicator field.

VISUAL IDENTIFICATION GUIDE (only for active indicators):
- IEA v8.5: Look for a panel labeled "Inst Edge" with Regime (TREND/RANGE/BREAKOUT/MIXED), and diamond-shaped BULL/BEAR signal labels on candles.
- AWA: Look for colored demand/supply order blocks on the chart with volume labels (Loud/High/Soft).
- WaveOscPro: Look for an oscillator panel at bottom with colored RSI-style candles and squeeze dots.
- Trade Execution Suite: Look for EXEC panel with a letter grade (A+/A/B/C), FTC counter (e.g. 3/4), and ACTION label. NOTE: EXEC grade is a LETTER not a percentage. Ignore any percentage values on chart — those belong to LPZ (Liquidity Probability Zones), not EXEC.

For image uploads: verify at least one active TDL indicator signature is visible. If none found return: {"blocked":true,"msg":"TDL indicators not detected. Ensure your selected indicators are active and visible on your chart."}

Return ONLY valid JSON, no markdown:
${jsonSchema}

Evaluate checklist only for active indicators: ${checklistItems.join(", ")}. Score 0-10: 8-10=A+, 6-7=A, 4-5=B, 2-3=C, 0-1=NO TRADE.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, imageB64, manualText, followUp, priorResult, activeIndicators } = body;
  const active: string[] = activeIndicators ?? ["iea", "awa", "wave", "exec"];

  try {
    if (followUp && priorResult) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: "You are the TDL Trade Co-Pilot. Answer follow-up trading questions concisely based on prior analysis. Be direct and institutional. No disclaimers. Format your response in plain text only, no markdown, no asterisks, no headers.",
        messages: [{ role: "user", content: `Prior analysis: ${JSON.stringify(priorResult)}\n\nQuestion: ${followUp}` }],
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
      content = `${manualText}\n\nReturn JSON only.`;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: buildSystemPrompt(active),
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
