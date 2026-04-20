import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    };
  }
  interface User {
    role: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // 30 minutes idle timeout: cookie verloopt 30 min na de laatste activiteit.
    // updateAge: 0 dwingt NextAuth om de cookie bij elke request te verlengen
    // (sliding window), zodat actief werk niet ineens wordt afgebroken.
    maxAge: 30 * 60,
    updateAge: 0,
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase().trim()))
          .limit(1);

        if (!user || !user.active) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isOnLogin = pathname.startsWith("/login");
      const isGarage = pathname.startsWith("/garage");
      const hasGarageCookie = !!request.cookies.get("garage_auth")?.value;
      // Did this browser ever hold a NextAuth session-token, even an
      // expired one? If so, we treat the device as an admin device and
      // bounce to /login on logout, instead of the workshop PWA. This
      // prevents admins whose session briefly hiccups from being
      // teleported into /garage because an old garage_auth cookie is
      // still lying around on the same browser.
      const looksLikeAdminDevice =
        !!request.cookies.get("authjs.session-token")?.value ||
        !!request.cookies.get("__Secure-authjs.session-token")?.value ||
        !!request.cookies.get("next-auth.session-token")?.value ||
        !!request.cookies.get("__Secure-next-auth.session-token")?.value;

      // Garage-PWA "lock-in": als deze browser een actieve garage-sessie heeft
      // en niet als admin is ingelogd, dan stuur alle navigatie buiten /garage
      // terug naar /garage. Zo kunnen werkers nooit per ongeluk in het admin-
      // dashboard of inlogscherm belanden (de tablet opent dit als app).
      //
      // Uitzondering: als dit apparaat overduidelijk een admin-device is
      // (heeft een NextAuth-cookie gezet gehad), respecteren we de
      // normale login-flow. Dat voorkomt dat admins naar /garage worden
      // gegooid wanneer hun sessie net aan het verversen is.
      if (
        hasGarageCookie &&
        !isLoggedIn &&
        !isGarage &&
        !isOnLogin &&
        !looksLikeAdminDevice
      ) {
        return Response.redirect(new URL("/garage", request.nextUrl));
      }

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      if (isGarage) {
        return true;
      }

      return isLoggedIn;
    },
  },
  events: {
    /**
     * Persist a "login" audit row whenever NextAuth issues a fresh
     * session (i.e. password sign-in, not on every JWT refresh). The
     * row is what powers the owner-only Activity portal at
     * /settings/activity. Failures are swallowed so a flaky audit
     * insert never blocks login.
     */
    async signIn({ user }) {
      if (!user?.id) return;
      try {
        await db.insert(auditLogs).values({
          userId: user.id,
          action: "login",
          entityType: "user",
          entityId: user.id,
        });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("[auth.events.signIn] could not write audit row", err);
        }
      }
    },
  },
});
