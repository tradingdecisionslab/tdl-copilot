import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/whop-sdk";
import { headers } from "next/headers";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const SYS = "You are the TDL Trade Co-Pilot. Return ONLY valid JSON, no markdown, no backticks. For image uploads, first check for TDL indicator signatures (IEA regime, Edge Score, AWA blocks, WaveOscPro, EXEC labels). If fewer than 2 found, return: {\"blocked\":true,\"msg\":\"TDL indicators not detected.\"}. Otherwise return: {\"blocked\":false,\"ticker\":\"string\",\"tf\":\"string\",\"dir\":\"LONG or SHORT or NEUTRAL\",\"grade\":\"A+ or A or B or C or NO TRADE\",\"score\":0,\"verdict\":\"GO or WAIT or NO TRADE\",\"iea\":{\"regime\":\"string\",\"edge\":\"string\",\"signal\":\"string\"},\"awa\":{\"block\":\"string\",\"vol\":\"string\",\"quality\":\"string\"},\"wave\":{\"mom\":\"string\",\"squeeze\":\"string\"},\"exec\":{\"score\":\"string\",\"grade\":\"string\",\"ftc\":\"string\",\"action\":\"string\",\"formation\":\"string\"},\"checklist\":[{\"item\":\"IEA Regime Aligned\",\"met\":true,\"note\":\"\"},{\"item\":\"Edge Score >=7\",\"met\":true,\"note\":\"\"},{\"item\":\"IEA Signal Diamond\",\"met\":true,\"note\":\"\"},{\"item\":\"AWA Block Present\",\"met\":true,\"note\":\"\"},{\"item\":\"AWA Volume Loud\",\"met\":true,\"note\":\"\"},{\"item\":\"WaveOsc Momentum Aligned\",\"met\":true,\"note\":\"\"},{\"item\":\"Squeeze Clear\",\"met\":true,\"note\":\"\"},{\"item\":\"EXEC Score >=80\",\"met\":true,\"note\":\"\"},{\"item\":\"FTC >=3/4 Aligned\",\"met\":true,\"note\":\"\"},{\"item\":\"Formation Non-Conflicting\",\"met\":true,\"note\":\"\"}],\"levels\":{\"entry\":\"string\",\"stop\":\"string\",\"t1\":\"string\",\"t2\":\"string\",\"rr\":\"string\"},\"narrative\":\"string\",\"warnings\":[\"string\"]}. Scoring: 8-10=A+, 6-7=A, 4-5=B, 2-3=C, 0-1=NO TRADE.";

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const userToken = headersList.get("x-whop-user-token") ?? req.headers.get("x-whop-user-token");
  const userId = await verifyUserToken(userToken ?? "");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, imageB64, manualText, followUp, priorResult } = body;

  try {
    if (followUp && priorResult) {
      const result = await model.generateContent([
        "You are the TDL Trade Co-Pilot. Answer follow-up trading questions concisely and institutionally based on the prior analysis.",
        "Prior: " + JSON.stringify(priorResult) + " Question: " + followUp,
      ]);
      return NextResponse.json({ answer: result.response.text() });
    }

    if (type === "image" && imageB64) {
      const result = await model.generateContent([
        SYS,
        { inlineData: { mimeType: "image/png", data: imageB64 } },
        "Analyze this chart. Return JSON only.",
      ]);
      const raw = result.response.text().replace(/```json|```/g, "").trim();
      return NextResponse.json(JSON.parse(raw));
    }

    const result = await model.generateContent([SYS, manualText + " Return JSON only."]);
    const raw = result.response.text().replace(/```json|```/g, "").trim();
    return NextResponse.json(JSON.parse(raw));

  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}
