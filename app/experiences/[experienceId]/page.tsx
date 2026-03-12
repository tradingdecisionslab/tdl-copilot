import { verifyUserToken } from "@/lib/whop-sdk";
import { headers } from "next/headers";
import { CoPilotApp } from "@/components/CoPilotApp";

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ experienceId: string }>;
}) {
  await params;
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

  return <CoPilotApp userId={userId} />;
}
