import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },

  callbacks: {
    session({ session, token }) {
      session.accessToken = token.accessToken;
      session.accessTokenExpiresAt = token.accessTokenExpiresAt;
      session.error = token.error;
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isAuthPage = ['/login', '/register'].includes(nextUrl.pathname);

      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl));
      }

      if (nextUrl.pathname.startsWith('/organiser')) {
        if (!isLoggedIn) {
          return false;
        }

        if (auth?.user?.role !== 'organiser') {
          return Response.redirect(new URL('/', nextUrl));
        }

        return true;
      }

      return true;
    },
  },

  providers: [],
} satisfies NextAuthConfig;
