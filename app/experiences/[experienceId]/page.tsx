import { verifyUserToken, whopApi } from "@/lib/whop-sdk";
import { headers } from "next/headers";
import { CoPilotApp } from "@/components/CoPilotApp";

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ experienceId: string }>;
}) {
  const { experienceId } = await params;
  const headersList = await headers();
  const userToken = headersList.get("x-whop-user-token");
  const userId = await verifyUserToken(userToken ?? "");

  if (!userId) {
    return (
      <div style={{ minHeight:"100vh", background:"#080c10", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:12 }}>⛔</div>
          <div style={{ color:"#ff4444", letterSpacing:2, fontSize:12 }}>ACCESS DENIED</div>
          <div style={{ color:"#4a7faa", marginTop:8, fontSize:11 }}>Please log in to your Whop account.</div>
        </div>
      </div>
    );
  }

  let hasAccess = false;
  try {
    const result = await whopApi.CheckIfUserHasAccessToExperience({ userId, experienceId });
    hasAccess = result.hasAccessToExperience ?? false;
  } catch {
    hasAccess = false;
  }

  if (!hasAccess) {
    return (
      <div style={{ minHeight:"100vh", background:"#080c10", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace" }}>
        <div style={{ textAlign:"center", maxWidth:380, padding:32 }}>
          <div style={{ fontSize:28, marginBottom:12 }}>🔒</div>
          <div style={{ color:"#ffd700", letterSpacing:2, fontSize:12, marginBottom:12 }}>INSTITUTIONAL SUITE REQUIRED</div>
          <div style={{ color:"#4a7faa", fontSize:11, lineHeight:1.7 }}>The TDL Trade Co-Pilot is exclusive to Institutional Suite subscribers.</div>
          <a href="https://whop.com/trading-decisions-lab" style={{ display:"inline-block", marginTop:20, padding:"10px 24px", background:"#0ea5e915", border:"1px solid #0ea5e9", color:"#0ea5e9", textDecoration:"none", fontSize:11, letterSpacing:2, fontFamily:"monospace" }}>
            UPGRADE NOW →
          </a>
        </div>
      </div>
    );
  }

  return <CoPilotApp userId={userId} />;
}
