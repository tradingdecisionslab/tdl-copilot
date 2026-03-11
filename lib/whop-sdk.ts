import { WhopApi, makeUserTokenVerifier } from "@whop/api";

export const whopApi = WhopApi({
  appApiKey: process.env.WHOP_API_KEY ?? "fallback",
  onBehalfOfUserId: process.env.WHOP_AGENT_USER_ID,
});

export const verifyUserToken = makeUserTokenVerifier({
  appId: process.env.NEXT_PUBLIC_WHOP_APP_ID ?? "fallback",
  dontThrow: true,
});
