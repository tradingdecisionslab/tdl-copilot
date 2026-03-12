import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = "You are the TDL Trade Co-Pilot, an elite institutional trade analysis engine for Trading Decisions Lab subscribers. For image uploads: first verify TDL indicators are visible (IEA regime label TREND/RANGE/BREAKOUT/MIXED, Edge Score panel, diamond signals, AWA demand/supply blocks, WaveOscPro RSI panel, EXEC score). If fewer than 2 TDL signatures found return: {\"blocked\":true,\"msg\":\"TDL indicators not detected. Ensure your TDL indicators are active and visible on your chart.\"}. For valid charts or manual input, return ONLY valid JSON with no markdown: {\"blocked\":false,\"ticker\":\"string\",\"tf\":\"string\",\"dir\":\"LONG|SHORT|NEUTRAL\",\"grade\":\"A+|A|B|C|NO TRADE\",\"score\":0,\"verdict\":\"GO|WAIT|NO TRADE\",\"iea\":{\"regime\":\"string\",\"edge\":\"string\",\"signal\":\"string\"},\"awa\":{\"block\":\"Demand|Supply|None\",\"vol\":\"Loud|High|Soft\",\"quality\":\"Untested|Retested|Broken\"},\"wave\":{\"mom\":\"Bullish|Bearish|Neutral\",\"squeeze\":\"Active|Released|None\"},\"exec\":{\"score\":\"string\",\"grade\":\"string\",\"ftc\":\"string\",\"action\":\"string\",\"formation\":\"string\"},\"checklist\":[{\"item\":\"string\",\"met\":true,\"note\":\"string\"}],\"levels\":{\"entry\":\"string\",\"stop\":\"string\",\"t1\":\"string\",\"t2\":\"string\",\"rr\":\"string\"},\"narrative\":\"string\",\"warnings\":[\"string\"]}. Checklist 10 items: IEA Regime Aligned, Edge Score 7+, IEA Signal Diamond, AWA Block Present, AWA Volume Loud, WaveOsc Momentum Aligned, Squeeze Clear, EXEC 80+, FTC 3/4+, Formation Non-Conflicting. Score: 8-10=A+ 6-7=A 4-5=B 2-3=C 0-1=NO TRADE.";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, imageB64, manualText, followUp, priorResult } = body;

  try {
    if (followUp && priorResult) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: "You are the TDL Trade Co-Pilot. Answer follow-up trading questions concisely based on prior analysis. Be direct and institutional. No disclaimers.",
        messages: [{ role: "user", content: `Prior analysis: ${JSON.stringify(priorResult)}\n\nQuestion: ${followUp}` }],
      });
      const text = response.content.find(b => b.type === "text")?.text ?? "";
      return NextResponse.json({ answer: text });
    }

    let content: Anthropic.MessageParam["content"];

    if (type === "image" && imageB64) {
      content = [
        { type: "image", source: { type: "base64", media_type: "image/png", data: imageB64 } },
        { type: "text", text: "Analyze this TradingView chart with TDL indicators. Return JSON only." }
      ];
    } else {
      content = `${manualText}\n\nReturn JSON only.`;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM,
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
