import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/whop-sdk";
import { headers } from "next/headers";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const SYSTEM_PROMPT = `You are the TDL Trade Co-Pilot. Return ONLY valid JSON, no markdown.

STEP 1 - VERIFY TDL INDICATORS (image uploads only): Scan for IEA regime label, Edge Score panel, AWA order blocks, WaveOscPro RSI panel, EXEC score labels. If fewer than 2 TDL signatures found, return ONLY: {"blocked":true,"msg":"TDL indicators not detected. Ensure IEA, AWA, and WaveOscPro are visible on your chart."}

STEP 2 - Return this exact JSON structure:
{"blocked":false,"ticker":"string","tf":"string","dir":"LONG or SHORT or NEUTRAL","grade":"A+ or A or B or C or NO TRADE","score":0,"verdict":"GO or WAIT or NO TRADE","iea":{"regime":"TREND or RANGE or BREAKOUT or MIXED or NOT DETECTED","edge":"number or NOT DETECTED","signal":"Long Diamond or Short Diamond or Continuation or None or NOT DETECTED"},"awa":{"block":"Demand or Supply or None or NOT DETECTED","vol":"Loud or High or Soft or NOT DETECTED","quality":"Untested or Retested or Broken or NOT DETECTED"},"wave":{"mom":"Bullish or Bearish or Neutral or NOT DETECTED","squeeze":"Active or Released or None or NOT DETECTED"},"exec":{"score":"string or NOT DETECTED","grade":"A+ or A or B or C or D or NOT DETECTED","ftc":"string or NOT DETECTED","action":"Go or Wait or No Trade or NOT DETECTED","formation":"ABW or DBW or CFB or Inside Bar or 2U or 2D or 3U or 3D or None"},"checklist":[{"item":"IEA Regime Aligned","met":true,"note":"brief note"},{"item":"Edge Score >=7","met":true,"note":"brief note"},{"item":"IEA Signal Diamond","met":true,"note":"brief note"},{"item":"AWA Block Present","met":true,"note":"brief note"},{"item":"AWA Volume Loud","met":true,"note":"brief note"},{"item":"WaveOsc Momentum Aligned","met":true,"note":"brief note"},{"item":"Squeeze Clear","met":true,"note":"brief note"},{"item":"EXEC Score >=80","met":true,"note":"brief note"},{"item":"FTC >=3/4 Aligned","met":true,"note":"brief note"},{"item":"Formation Non-Conflicting","met":true,"note":"brief note"}],"levels":{"entry":"price","stop":"price","t1":"price","t2":"price or null","rr":"R:R"},"narrative":"2-3 sentence institutional analysis","warnings":["risk flags"]}

Scoring: 8-10=A+ | 6-7=A | 4-5=B | 2-3=C | 0-1=NO TRADE. Loud AWA = highest conviction. MIXED regime = caution flag.`;

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const userToken =
    headersList.get("x-whop-user-token") ??
    req.headers.get("x-whop-user-token");
  const userId = await verifyUserToken(userToken ?? "");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, imageB64, manualText, followUp, priorResult } = body;

  try {
    if (followUp && priorResult) {
      const result = await model.generateContent([
        "You are the TDL Trade Co-Pilot. Answer follow-up trading questions concisely based on the prior analysis. Be institutional. No disclaimers needed.",
        "Prior analysis: " + JSON.stringify(priorResult) + "\n\nSubscriber question: " + followUp,
      ]);
      return NextResponse.json({ answer: result.response.text() });
    }

    if (type === "image" && imageB64) {
      const result = await model.generateContent([
        SYSTEM_PROMPT,
        { inlineData: { mimeType: "image/png", data: imageB64 } },
        "Analyze this TradingView chart. Verify TDL indicators, then return full JSON. No markdown.",
      ]);
      const raw = result.response.text();
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return NextResponse.json(parsed);
    }

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      manualText + "\n\nReturn JSON only. No markdown.",
    ]);
    const raw = result.response.text();
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);

  } catch (e) {
    console.error("Analysis error:", e);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
