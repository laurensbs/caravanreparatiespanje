import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
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

      // Garage-PWA "lock-in": als deze browser een actieve garage-sessie heeft
      // en niet als admin is ingelogd, dan stuur alle navigatie buiten /garage
      // terug naar /garage. Zo kunnen werkers nooit per ongeluk in het admin-
      // dashboard of inlogscherm belanden (de tablet opent dit als app).
      if (hasGarageCookie && !isLoggedIn && !isGarage) {
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
});
