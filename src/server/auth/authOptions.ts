import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { credentialsSchema } from '@/contracts/auth';
import { verifyPassword } from './password';

/**
 * Auth.js v5 config.
 *
 * - JWT session strategy. Required when using the Credentials provider
 *   and lets middleware read the user role without a DB hit.
 * - PrismaAdapter is intentionally NOT attached here; Auth.js v5 with
 *   the `jwt` strategy stores no session in the DB. We still issue
 *   `Account` rows manually for OAuth via the `signIn` callback if/when
 *   we need richer linking. For now JWT-only is enough for Phase 2.
 * - The role and id are encoded into the token at sign-in and exposed
 *   via the session callback to the client + server consumers.
 *
 * Public-side providers like Google are only registered if the env
 * vars are set, so a fresh clone works out of the box with credentials.
 */
const useGoogle = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true, image: true },
        });
        if (!user || !user.passwordHash) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        };
      },
    }),
    ...(useGoogle
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For Google sign-ins, ensure a User row exists so the rest of the
      // app (orders, cart, reviews) has a stable FK target. We do not
      // store Google's account row separately in JWT mode - the link is
      // by email.
      if (account?.provider === 'google' && user?.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email } });
        if (!existing) {
          const created = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name ?? user.email.split('@')[0],
              image: user.image ?? null,
              emailVerified: new Date(),
            },
            select: { id: true, role: true },
          });
          (user as { id?: string; role?: UserRole }).id = created.id;
          (user as { id?: string; role?: UserRole }).role = created.role;
        } else {
          (user as { id?: string; role?: UserRole }).id = existing.id;
          (user as { id?: string; role?: UserRole }).role = existing.role;
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: UserRole };
        if (u.id) token.sub = u.id;
        if (u.role) token.role = u.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as UserRole;
      return session;
    },
  },
};
