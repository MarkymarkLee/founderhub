import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      // GitHub now sends an RFC 9207 `iss` on the callback; without this the check compares it to a placeholder and fails
      issuer: "https://github.com/login/oauth",
      // repo scope lets the publish action push the founder's landing page
      authorization: { params: { scope: "read:user user:email repo" } },
      profile(p, tokens) {
        return {
          id: String(p.id),
          name: p.name ?? p.login,
          email: p.email ?? undefined, // null for private GitHub emails; the users schema wants a string or nothing
          image: p.avatar_url,
          githubLogin: p.login,
          githubToken: tokens.access_token,
        };
      },
    }),
  ],
});
