import { makeUserTokenVerifier } from "@whop/api";

export const whopApi = {
  CheckIfUserHasAccessToExperience: async ({
    userId,
    experienceId,
  }: {
    userId: string;
    experienceId: string;
  }) => {
    const response = await fetch(
      `https://api.whop.com/api/v5/apps/experiences/${experienceId}/check_user_has_access`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );
    const data = await response.json();
    return { hasAccessToExperience: data.has_access ?? false };
  },
};

export const verifyUserToken = makeUserTokenVerifier({
  appId: process.env.NEXT_PUBLIC_WHOP_APP_ID ?? "fallback",
  dontThrow: true,
});
