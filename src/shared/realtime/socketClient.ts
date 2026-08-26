import { io, Socket } from 'socket.io-client';

import { getSocketAuthToken } from '@/shared/api/axiosClient';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env.local.');
}

/**
 * Socket.IO attaches to the SAME HTTP server the REST API runs on (`backend/src/main.ts`) — it
 * is not a separate service on a separate port. `NEXT_PUBLIC_API_BASE_URL` carries the API's own
 * `/api` prefix, which the socket connection must NOT include: Socket.IO's handshake path
 * (`/socket.io/`) sits at the server's root, alongside `/api`, not underneath it.
 */
const socketOrigin = apiBaseUrl.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

/**
 * One shared connection for the whole app, created lazily on first use — never one socket per
 * component. Every component that wants live updates calls `ensureConnected()`; none of them
 * "own" the connection or need to coordinate about who created it.
 *
 * `TR-DEC-013`: the handshake carries the current access token. `auth` is passed as a FUNCTION
 * rather than a static object specifically so it re-runs on every (re)connection attempt,
 * fetching whatever token is current at THAT moment — not the one that happened to be valid when
 * the socket was first created. That one property is the entire "re-auth on reconnect"
 * requirement: it needs no reconnect-specific code, because Socket.IO already calls `auth` again
 * before every reconnect attempt by design, and `getSocketAuthToken()` already refreshes the
 * session first if the cached token is stale — the identical logic the axios interceptor uses.
 */
function getSocket(): Socket {
  socket ??= io(socketOrigin, {
    autoConnect: false,
    transports: ['websocket'],
    auth: (callback) => {
      void getSocketAuthToken().then((token) => callback({ token }));
    },
  });

  return socket;
}

/** Safe to call from every component that wants live updates — connects only if not already. */
export function ensureConnected(): Socket {
  const client = getSocket();
  if (!client.connected) {
    client.connect();
  }
  return client;
}
